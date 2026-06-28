use crate::domain::torrent::TorrentRepository;
use crate::torrent::{format_hash, AddTorrentResult, FileDetails, TorrentStatusInfo};
use async_trait::async_trait;
use librqbit::{AddTorrent, ManagedTorrent, Session};
use std::sync::Arc;

pub struct RqbitTorrentRepository {
    session: Arc<Session>,
    get_download_dir_fn: Arc<dyn Fn() -> String + Send + Sync>,
}

impl RqbitTorrentRepository {
    pub fn new(
        session: Arc<Session>,
        get_download_dir_fn: Arc<dyn Fn() -> String + Send + Sync>,
    ) -> Self {
        Self {
            session,
            get_download_dir_fn,
        }
    }

    fn find_torrent_by_hex(&self, hex_hash: &str) -> Option<Arc<ManagedTorrent>> {
        self.session.with_torrents(|iter| {
            for (_, torrent) in iter {
                let hex = format_hash(&torrent.info_hash().0);
                if hex.eq_ignore_ascii_case(hex_hash) {
                    return Some(torrent.clone());
                }
            }
            None
        })
    }
}

#[async_trait]
impl TorrentRepository for RqbitTorrentRepository {
    async fn add_magnet(&self, magnet: &str) -> Result<AddTorrentResult, String> {
        let output_folder = (self.get_download_dir_fn)();
        let options = librqbit::AddTorrentOptions {
            overwrite: true,
            output_folder: Some(output_folder),
            ..Default::default()
        };

        let magnet_with_trackers = append_default_trackers(magnet);

        let response = self
            .session
            .add_torrent(AddTorrent::from_url(&magnet_with_trackers), Some(options))
            .await
            .map_err(|e| format!("Failed to add torrent: {}", e))?;

        let handle = response
            .into_handle()
            .ok_or_else(|| "Failed to get torrent handle".to_string())?;

        // Wait with a 20s timeout
        tokio::time::timeout(
            std::time::Duration::from_secs(20),
            handle.wait_until_initialized(),
        )
        .await
        .map_err(|_| "解析种子元数据超时，可能该种子目前没有在线的做种者".to_string())?
        .map_err(|e| format!("解析种子失败: {}", e))?;

        let info_hash = format_hash(&handle.info_hash().0);
        let name = handle.name();

        let files = handle
            .with_metadata(|meta| {
                meta.file_infos
                    .iter()
                    .enumerate()
                    .map(|(id, fi)| FileDetails {
                        id,
                        name: fi.relative_filename.to_string_lossy().to_string(),
                        len: fi.len,
                    })
                    .collect::<Vec<_>>()
            })
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        Ok(AddTorrentResult {
            info_hash,
            name,
            files,
        })
    }

    fn get_torrent_status(&self, info_hash_hex: &str) -> Option<TorrentStatusInfo> {
        let torrent = self.find_torrent_by_hex(info_hash_hex)?;
        let stats = torrent.stats();

        let speed = stats
            .live
            .as_ref()
            .map(|l| (l.download_speed.mbps * 1024.0 * 1024.0) as u64)
            .unwrap_or(0);

        let (peers_connected, peers_total) = stats
            .live
            .as_ref()
            .map(|l| {
                (
                    l.snapshot.peer_stats.live as u32,
                    l.snapshot.peer_stats.seen as u32,
                )
            })
            .unwrap_or((0, 0));

        Some(TorrentStatusInfo {
            info_hash: info_hash_hex.to_string(),
            name: torrent.name(),
            progress_bytes: stats.progress_bytes,
            total_bytes: stats.total_bytes,
            finished: stats.finished,
            download_speed_bytes_per_sec: speed,
            paused: torrent.is_paused(),
            peers_connected,
            peers_total,
        })
    }

    fn list_torrents(&self) -> Vec<TorrentStatusInfo> {
        self.session.with_torrents(|iter| {
            iter.map(|(_, torrent)| {
                let stats = torrent.stats();
                let speed = stats
                    .live
                    .as_ref()
                    .map(|l| (l.download_speed.mbps * 1024.0 * 1024.0) as u64)
                    .unwrap_or(0);
                let (peers_connected, peers_total) = stats
                    .live
                    .as_ref()
                    .map(|l| {
                        (
                            l.snapshot.peer_stats.live as u32,
                            l.snapshot.peer_stats.seen as u32,
                        )
                    })
                    .unwrap_or((0, 0));
                let hex = format_hash(&torrent.info_hash().0);
                TorrentStatusInfo {
                    info_hash: hex,
                    name: torrent.name(),
                    progress_bytes: stats.progress_bytes,
                    total_bytes: stats.total_bytes,
                    finished: stats.finished,
                    download_speed_bytes_per_sec: speed,
                    paused: torrent.is_paused(),
                    peers_connected,
                    peers_total,
                }
            })
            .collect()
        })
    }

    async fn pause_torrent(&self, info_hash_hex: &str) -> Result<(), String> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or_else(|| "Torrent not found".to_string())?;
        self.session
            .pause(&torrent)
            .await
            .map_err(|e| format!("Failed to pause torrent: {}", e))?;
        Ok(())
    }

    async fn resume_torrent(&self, info_hash_hex: &str) -> Result<(), String> {
        let torrent = self
            .find_torrent_by_hex(info_hash_hex)
            .ok_or_else(|| "Torrent not found".to_string())?;
        self.session
            .unpause(&torrent)
            .await
            .map_err(|e| format!("Failed to resume torrent: {}", e))?;
        Ok(())
    }

    async fn delete_torrent(&self, info_hash_hex: &str, delete_files: bool) -> Result<(), String> {
        use librqbit::api::TorrentIdOrHash;
        let id = TorrentIdOrHash::try_from(info_hash_hex)
            .map_err(|e| format!("Invalid info hash format: {}", e))?;
        self.session
            .delete(id, delete_files)
            .await
            .map_err(|e| format!("Failed to delete torrent: {}", e))?;
        Ok(())
    }

    fn get_torrent_files(&self, info_hash_hex: &str) -> Option<Vec<FileDetails>> {
        let torrent = self.find_torrent_by_hex(info_hash_hex)?;
        torrent
            .with_metadata(|meta| {
                meta.file_infos
                    .iter()
                    .enumerate()
                    .map(|(id, fi)| FileDetails {
                        id,
                        name: fi.relative_filename.to_string_lossy().to_string(),
                        len: fi.len,
                    })
                    .collect::<Vec<_>>()
            })
            .ok()
    }

    fn get_file_reader(
        &self,
        info_hash: &str,
        file_id: usize,
    ) -> Result<Box<dyn crate::domain::torrent::AsyncReadSeek>, String> {
        let torrent = self
            .find_torrent_by_hex(info_hash)
            .ok_or_else(|| "Torrent not found".to_string())?;
        let stream = torrent
            .stream(file_id)
            .map_err(|e| format!("Failed to open torrent stream: {}", e))?;
        Ok(Box::new(stream))
    }
}

fn append_default_trackers(magnet: &str) -> String {
    let mut magnet_with_trackers = magnet.to_string();

    // Stable and active public trackers
    let default_trackers = [
        "udp://tracker.opentrackr.org:1337/announce",
        "http://tracker.gbitt.info:80/announce",
        "udp://open.stealth.si:80/announce",
        "udp://tracker.coppersurfer.tk:6969/announce",
        "udp://exodus.desync.com:6969/announce",
        "udp://tracker.leechers-paradise.org:6969/announce",
        "udp://tracker.internetwarriors.net:1337/announce",
        "udp://tracker.cyberia.is:6969/announce",
        "udp://tracker.torrent.eu.org:451/announce",
        "udp://tracker.moack.co.kr:80/announce",
        "udp://explodie.org:6969/announce",
        "http://tracker.openbittorrent.com:80/announce",
    ];

    for tracker in default_trackers.iter() {
        let encoded_tracker = urlencoding::encode(tracker);
        // Only append if the tracker is not already present (both in raw and encoded form)
        if !magnet.contains(tracker) && !magnet.contains(&encoded_tracker.to_string()) {
            if !magnet_with_trackers.contains('?') {
                magnet_with_trackers.push('?');
            } else if !magnet_with_trackers.ends_with('&') && !magnet_with_trackers.ends_with('?') {
                magnet_with_trackers.push('&');
            }
            magnet_with_trackers.push_str("tr=");
            magnet_with_trackers.push_str(&encoded_tracker);
        }
    }

    magnet_with_trackers
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[allow(non_snake_case)]
    fn 测试_追加默认Tracker_应成功() {
        let raw_magnet = "magnet:?xt=urn:btih:9e7a29997087a067e5e0b6fa50653288bd2aabff";
        let with_trackers = append_default_trackers(raw_magnet);

        assert!(with_trackers.contains("tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce"));
        assert!(with_trackers.contains("tr=http%3A%2F%2Ftracker.gbitt.info%3A80%2Fannounce"));

        // If it already has trackers, it shouldn't duplicate
        let raw_magnet_2 = format!(
            "{}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce",
            raw_magnet
        );
        let with_trackers_2 = append_default_trackers(&raw_magnet_2);

        // Count occurrences of opentrackr
        let occurrences = with_trackers_2.matches("tracker.opentrackr.org").count();
        assert_eq!(occurrences, 1);
    }
}
