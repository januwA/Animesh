use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Rss {
    pub channel: Channel,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Channel {
    #[serde(default)]
    pub title: String,
    #[serde(rename = "item", default)]
    pub items: Vec<Item>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Item {
    pub title: String,
    pub link: String,
    #[serde(rename = "pubDate", default)]
    pub pub_date: String,
    pub enclosure: Enclosure,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Enclosure {
    #[serde(rename = "@url")]
    pub url: String,
    #[serde(rename = "@length")]
    pub length: Option<u64>,
}

pub use crate::domain::crawler::SearchResultItem;

/// Parse DMHY RSS XML data into SearchResultItems
pub fn parse_dmhy_rss(xml_data: &str) -> Result<Vec<SearchResultItem>, String> {
    let rss: Rss = quick_xml::de::from_str(xml_data)
        .map_err(|e| format!("Failed to deserialize DMHY XML data: {}", e))?;

    let results = rss
        .channel
        .items
        .into_iter()
        .map(|item| SearchResultItem {
            title: item.title,
            link: item.link,
            pub_date: item.pub_date,
            magnet: item.enclosure.url,
            size: item.enclosure.length,
        })
        .collect();

    Ok(results)
}

#[derive(Debug, Deserialize)]
pub struct BangumiMoeSearchResult {
    pub torrents: Vec<BangumiMoeTorrent>,
}

#[derive(Debug, Deserialize)]
pub struct BangumiMoeTorrent {
    #[serde(rename = "_id")]
    pub id: String,
    pub title: String,
    pub publish_time: String,
    pub magnet: Option<String>,
    #[serde(rename = "infoHash")]
    pub info_hash: Option<String>,
    pub size: Option<String>,
}

fn parse_size_to_bytes(size_str: &str) -> Option<u64> {
    let size_str = size_str.trim();
    if size_str.is_empty() {
        return None;
    }
    let mut num_str = String::new();
    let mut unit_str = String::new();
    for c in size_str.chars() {
        if c.is_ascii_digit() || c == '.' {
            num_str.push(c);
        } else if c.is_alphabetic() {
            unit_str.push(c);
        }
    }
    let val: f64 = num_str.parse().ok()?;
    let unit = unit_str.trim().to_uppercase();
    let multiplier = match unit.as_str() {
        "KB" | "K" | "KIB" => 1024.0,
        "MB" | "M" | "MIB" => 1024.0 * 1024.0,
        "GB" | "G" | "GIB" => 1024.0 * 1024.0 * 1024.0,
        "TB" | "T" | "TIB" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        "B" => 1.0,
        _ => 1.0,
    };
    Some((val * multiplier) as u64)
}

pub fn parse_bangumi_moe_json(json_data: &str) -> Result<Vec<SearchResultItem>, String> {
    let res: BangumiMoeSearchResult = serde_json::from_str(json_data)
        .map_err(|e| format!("Failed to deserialize Bangumi.moe JSON data: {}", e))?;

    let results = res
        .torrents
        .into_iter()
        .map(|item| {
            let mut magnet = item.magnet.unwrap_or_else(|| {
                item.info_hash
                    .as_ref()
                    .map(|h| format!("magnet:?xt=urn:btih:{}", h))
                    .unwrap_or_default()
            });
            if !magnet.is_empty() {
                magnet.push_str("&tr=http://tr.bangumi.moe:6969/announce&tr=udp://tr.bangumi.moe:6969/announce&tr=https://tr.bangumi.moe:9696/announce");
            }
            SearchResultItem {
                title: item.title,
                link: format!("https://bangumi.moe/torrent/{}", item.id),
                pub_date: item.publish_time,
                magnet,
                size: item.size.as_deref().and_then(parse_size_to_bytes),
            }
        })
        .collect();

    Ok(results)
}

fn extract_hash_from_url(url: &str) -> Option<String> {
    if let Some(last_segment) = url.split('/').next_back() {
        let segment = last_segment
            .strip_suffix(".torrent")
            .unwrap_or(last_segment);
        if segment.len() == 40 && segment.chars().all(|c| c.is_ascii_hexdigit()) {
            return Some(segment.to_lowercase());
        }
    }
    None
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MikanRss {
    pub channel: MikanChannel,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MikanChannel {
    #[serde(default)]
    pub title: String,
    #[serde(rename = "item", default)]
    pub items: Vec<MikanItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MikanItem {
    pub title: String,
    pub link: String,
    pub torrent: MikanTorrent,
    pub enclosure: Enclosure,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MikanTorrent {
    #[serde(rename = "pubDate", default)]
    pub pub_date: String,
}

pub fn parse_mikan_rss(xml_data: &str) -> Result<Vec<SearchResultItem>, String> {
    let rss: MikanRss = quick_xml::de::from_str(xml_data)
        .map_err(|e| format!("Failed to deserialize Mikan XML data: {}", e))?;

    let results = rss
        .channel
        .items
        .into_iter()
        .map(|item| {
            let hash = extract_hash_from_url(&item.link)
                .or_else(|| extract_hash_from_url(&item.enclosure.url))
                .unwrap_or_default();
            let magnet = if hash.is_empty() {
                String::new()
            } else {
                format!("magnet:?xt=urn:btih:{}", hash)
            };

            SearchResultItem {
                title: item.title,
                link: item.link,
                pub_date: item.torrent.pub_date,
                magnet,
                size: item.enclosure.length,
            }
        })
        .collect();

    Ok(results)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NyaaRss {
    pub channel: NyaaChannel,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NyaaChannel {
    #[serde(default)]
    pub title: String,
    #[serde(rename = "item", default)]
    pub items: Vec<NyaaItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NyaaItem {
    pub title: String,
    pub link: String,
    #[serde(rename = "pubDate", default)]
    pub pub_date: String,
    #[serde(rename = "infoHash")]
    pub info_hash: String,
    #[serde(rename = "size")]
    pub size: String,
}

pub fn parse_nyaa_rss(xml_data: &str) -> Result<Vec<SearchResultItem>, String> {
    let rss: NyaaRss = quick_xml::de::from_str(xml_data)
        .map_err(|e| format!("Failed to deserialize Nyaa XML data: {}", e))?;

    let results = rss
        .channel
        .items
        .into_iter()
        .map(|item| {
            let magnet = if item.info_hash.is_empty() {
                String::new()
            } else {
                format!("magnet:?xt=urn:btih:{}", item.info_hash.to_lowercase())
            };
            SearchResultItem {
                title: item.title,
                link: item.link,
                pub_date: item.pub_date,
                magnet,
                size: parse_size_to_bytes(&item.size),
            }
        })
        .collect();

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_size_to_bytes() {
        assert_eq!(
            parse_size_to_bytes("557.33 MB"),
            Some((557.33 * 1024.0 * 1024.0) as u64)
        );
        assert_eq!(
            parse_size_to_bytes("1.2 GB"),
            Some((1.2 * 1024.0 * 1024.0 * 1024.0) as u64)
        );
        assert_eq!(parse_size_to_bytes("100 KB"), Some(100 * 1024));
        assert_eq!(parse_size_to_bytes(" 500 B "), Some(500));
        assert_eq!(parse_size_to_bytes(""), None);
        assert_eq!(parse_size_to_bytes("100 B"), Some(100));
        assert_eq!(parse_size_to_bytes("100 XYZ"), Some(100));
        assert_eq!(
            parse_size_to_bytes("438.3 MiB"),
            Some((438.3 * 1024.0 * 1024.0) as u64)
        );
        assert_eq!(
            parse_size_to_bytes("1.5 GiB"),
            Some((1.5 * 1024.0 * 1024.0 * 1024.0) as u64)
        );
    }

    #[test]
    fn test_parse_bangumi_moe_json_mock() {
        let mock_json = r#"{
            "torrents": [
                {
                    "_id": "6a38a56aa9616b2639aa281d",
                    "title": "[黒ネズミたち] xxx EP 179",
                    "publish_time": "2026-06-22T03:00:58.506Z",
                    "magnet": "magnet:?xt=urn:btih:9e7a29997087a067e5e0b6fa50653288bd2aabff",
                    "infoHash": "9e7a29997087a067e5e0b6fa50653288bd2aabff",
                    "size": "557.33 MB"
                }
            ]
        }"#;

        let results = parse_bangumi_moe_json(mock_json).unwrap();
        assert_eq!(results.len(), 1);
        let item = &results[0];
        assert_eq!(item.title, "[黒ネズミたち] xxx EP 179");
        assert_eq!(
            item.link,
            "https://bangumi.moe/torrent/6a38a56aa9616b2639aa281d"
        );
        assert_eq!(item.pub_date, "2026-06-22T03:00:58.506Z");
        assert_eq!(
            item.magnet,
            "magnet:?xt=urn:btih:9e7a29997087a067e5e0b6fa50653288bd2aabff&tr=http://tr.bangumi.moe:6969/announce&tr=udp://tr.bangumi.moe:6969/announce&tr=https://tr.bangumi.moe:9696/announce"
        );
        assert_eq!(item.size, Some((557.33 * 1024.0 * 1024.0) as u64));
    }

    #[test]
    fn test_parse_dmhy_rss_mock() {
        let mock_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>动漫花园 -- xxx</title>
    <item>
      <title>[神楽坂 まひろ] xxx - 9 (1080P HEVC MKV)</title>
      <link>http://share.dmhy.org/topics/view/635711.html</link>
      <pubDate>Mon, 23 Jun 2026 12:00:00 +0800</pubDate>
      <enclosure url="magnet:?xt=urn:btih:TESTMAGNET" length="350000000" type="application/x-bittorrent" />
    </item>
  </channel>
</rss>"#;

        let items = parse_dmhy_rss(mock_xml).unwrap();
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(item.title, "[神楽坂 まひろ] xxx - 9 (1080P HEVC MKV)");
        assert_eq!(item.link, "http://share.dmhy.org/topics/view/635711.html");
        assert_eq!(item.pub_date, "Mon, 23 Jun 2026 12:00:00 +0800");
        assert_eq!(item.magnet, "magnet:?xt=urn:btih:TESTMAGNET");
        assert_eq!(item.size, Some(350000000));
    }

    #[test]
    fn test_parse_dmhy_rss_invalid() {
        let invalid_xml = "<invalid>";
        let result = parse_dmhy_rss(invalid_xml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to deserialize"));
    }

    #[test]
    fn test_parse_bangumi_moe_json_missing_magnet() {
        let mock_json = r#"{
            "torrents": [
                {
                    "_id": "6a38a56aa9616b2639aa281d",
                    "title": "测试视频",
                    "publish_time": "2026-06-22T03:00:58.506Z",
                    "magnet": null,
                    "infoHash": "9e7a29997087a067e5e0b6fa50653288bd2aabff",
                    "size": "500 MB"
                },
                {
                    "_id": "6a38a56aa9616b2639aa281e",
                    "title": "测试视频2",
                    "publish_time": "2026-06-22T03:00:58.506Z",
                    "magnet": null,
                    "infoHash": null,
                    "size": null
                }
            ]
        }"#;

        let results = parse_bangumi_moe_json(mock_json).unwrap();
        assert_eq!(results.len(), 2);
        assert!(results[0]
            .magnet
            .contains("magnet:?xt=urn:btih:9e7a29997087a067e5e0b6fa50653288bd2aabff"));
        assert!(results[1].magnet.is_empty());
    }

    #[test]
    fn 测试_解析mikan_rss_模拟数据() {
        let mock_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Mikan Project - 搜索结果:xxx</title>
    <item>
      <title>[黒ネズミたち] xxx - 179</title>
      <link>https://mikanani.me/Home/Episode/9e7a29997087a067e5e0b6fa50653288bd2aabff</link>
      <torrent xmlns="https://mikanani.me/0.1/">
        <link>https://mikanani.me/Home/Episode/9e7a29997087a067e5e0b6fa50653288bd2aabff</link>
        <contentLength>557318144</contentLength>
        <pubDate>2026-06-22T11:00:58.074015</pubDate>
      </torrent>
      <enclosure type="application/x-bittorrent" length="557318144" url="https://mikanani.me/Download/20260622/9e7a29997087a067e5e0b6fa50653288bd2aabff.torrent" />
    </item>
  </channel>
</rss>"#;

        let items = parse_mikan_rss(mock_xml).unwrap();
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(item.title, "[黒ネズミたち] xxx - 179");
        assert_eq!(
            item.link,
            "https://mikanani.me/Home/Episode/9e7a29997087a067e5e0b6fa50653288bd2aabff"
        );
        assert_eq!(item.pub_date, "2026-06-22T11:00:58.074015");
        assert_eq!(
            item.magnet,
            "magnet:?xt=urn:btih:9e7a29997087a067e5e0b6fa50653288bd2aabff"
        );
        assert_eq!(item.size, Some(557318144));
    }

    #[test]
    fn 测试_解析nyaa_rss_模拟数据() {
        let mock_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:nyaa="https://nyaa.si/xmlns/nyaa" version="2.0">
  <channel>
    <title>Nyaa - "xxx" - Torrent File RSS</title>
    <item>
      <title>[FSP DN] A Record of a Mortal’s Journey to Immortality - 179 (1080p) | xxx</title>
      <link>https://nyaa.si/download/2123662.torrent</link>
      <guid isPermaLink="true">https://nyaa.si/view/2123662</guid>
      <pubDate>Sat, 20 Jun 2026 14:23:11 -0000</pubDate>
      <nyaa:infoHash>02884c75f52f499ba9eafb31004526bfd7ec8c1b</nyaa:infoHash>
      <nyaa:size>438.3 MiB</nyaa:size>
    </item>
  </channel>
</rss>"#;

        let items = parse_nyaa_rss(mock_xml).unwrap();
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(
            item.title,
            "[FSP DN] A Record of a Mortal’s Journey to Immortality - 179 (1080p) | xxx"
        );
        assert_eq!(item.link, "https://nyaa.si/download/2123662.torrent");
        assert_eq!(item.pub_date, "Sat, 20 Jun 2026 14:23:11 -0000");
        assert_eq!(
            item.magnet,
            "magnet:?xt=urn:btih:02884c75f52f499ba9eafb31004526bfd7ec8c1b"
        );
        assert_eq!(item.size, Some((438.3 * 1024.0 * 1024.0) as u64));
    }

    #[test]
    fn 测试_解析mikan_rss_无效数据() {
        let invalid_xml = "<invalid>";
        let result = parse_mikan_rss(invalid_xml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to deserialize"));
    }

    #[test]
    fn 测试_解析nyaa_rss_无效数据() {
        let invalid_xml = "<invalid>";
        let result = parse_nyaa_rss(invalid_xml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to deserialize"));
    }
}
