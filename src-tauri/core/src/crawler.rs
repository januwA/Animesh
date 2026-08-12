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
    #[serde(rename = "description", default)]
    pub description: String,
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
            description: item.description,
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
    #[serde(default)]
    pub description: String,
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
                description: item.description,
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
    #[serde(rename = "description", default)]
    pub description: String,
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
                description: item.description,
            }
        })
        .collect();

    Ok(results)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AcgRipRss {
    pub channel: AcgRipChannel,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AcgRipChannel {
    #[serde(default)]
    pub title: String,
    #[serde(rename = "item", default)]
    pub items: Vec<AcgRipItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AcgRipItem {
    pub title: String,
    pub link: String,
    #[serde(rename = "pubDate", default)]
    pub pub_date: String,
    #[serde(rename = "description", default)]
    pub description: String,
    #[serde(rename = "contentLength", default)]
    pub content_length: Option<u64>,
    pub enclosure: Enclosure,
}

/// Parse ACG.RIP RSS XML data into SearchResultItems.
///
/// ACG.RIP 的搜索结果只提供 .torrent 下载链接，不提供磁力链接，
/// 因此 magnet 字段直接使用种子文件的下载地址。
pub fn parse_acgrip_rss(xml_data: &str) -> Result<Vec<SearchResultItem>, String> {
    let rss: AcgRipRss = quick_xml::de::from_str(xml_data)
        .map_err(|e| format!("Failed to deserialize ACG.RIP XML data: {}", e))?;

    let results = rss
        .channel
        .items
        .into_iter()
        .map(|item| SearchResultItem {
            title: item.title,
            link: item.link,
            pub_date: item.pub_date,
            magnet: item.enclosure.url,
            description: item.description,
        })
        .collect();

    Ok(results)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnibtRss {
    pub channel: AnibtChannel,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnibtChannel {
    #[serde(default)]
    pub title: String,
    #[serde(rename = "item", default)]
    pub items: Vec<AnibtItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnibtItem {
    pub title: String,
    pub link: String,
    #[serde(rename = "pubDate", default)]
    pub pub_date: String,
    #[serde(rename = "description", default)]
    pub description: String,
    pub torrent: AnibtTorrent,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnibtTorrent {
    #[serde(rename = "contentLength", default)]
    pub content_length: Option<u64>,
    #[serde(rename = "magneturi", default)]
    pub magnet_uri: String,
}

/// Parse AniBT RSS XML data into SearchResultItems.
pub fn parse_anibt_rss(xml_data: &str) -> Result<Vec<SearchResultItem>, String> {
    let rss: AnibtRss = quick_xml::de::from_str(xml_data)
        .map_err(|e| format!("Failed to deserialize AniBT XML data: {}", e))?;

    let results = rss
        .channel
        .items
        .into_iter()
        .map(|item| SearchResultItem {
            title: item.title,
            link: item.link,
            pub_date: item.pub_date,
            magnet: item.torrent.magnet_uri,
            description: item.description,
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
    #[serde(rename = "description", default)]
    pub description: String,
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
                description: item.description,
            }
        })
        .collect();

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

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
                    "size": "557.33 MB",
                    "description": "EP 179 1080P 简体内封"
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
        assert_eq!(item.description, "EP 179 1080P 简体内封");
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
      <description><![CDATA[<p>EP 9 1080P HEVC 内封字幕</p>]]></description>
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
        assert_eq!(item.description, "<p>EP 9 1080P HEVC 内封字幕</p>");
    }

    #[test]
    fn test_parse_dmhy_rss_invalid() {
        let invalid_xml = "<invalid>";
        let result = parse_dmhy_rss(invalid_xml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to deserialize"));
    }

    #[test]
    fn 测试_解析dmhy_rss_缺少description时默认为空字符串() {
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
        assert_eq!(items[0].description, "");
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
        assert!(results[0].description.is_empty());
        assert!(results[1].description.is_empty());
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
      <description><![CDATA[<p>EP 179 1080P 内封字幕</p>]]></description>
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
        assert_eq!(item.description, "<p>EP 179 1080P 内封字幕</p>");
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
      <description><![CDATA[<a href="https://nyaa.si/view/2123662">#2123662 | [FSP DN] xxx</a> | 438.3 MiB | Anime - Raw | 02884c75f52f499ba9eafb31004526bfd7ec8c1b]]></description>
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
        assert_eq!(
            item.description,
            "<a href=\"https://nyaa.si/view/2123662\">#2123662 | [FSP DN] xxx</a> | 438.3 MiB | Anime - Raw | 02884c75f52f499ba9eafb31004526bfd7ec8c1b"
        );
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

    #[test]
    fn 测试_解析acgrip_rss_模拟数据() {
        let mock_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torrent="http://xmlns.ezrss.it/0.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>ACG.RIP</title>
    <item>
      <title>[jibaketa合成] 葬送的芙莉蓮 第二季 - 10 END</title>
      <pubDate>Fri, 05 Jun 2026 08:15:41 -0700</pubDate>
      <link>https://acg.rip/t/355679</link>
      <guid>https://acg.rip/t/355679</guid>
      <description><![CDATA[<p>YLJ字幕社 1080P 内封字幕 合集</p>]]></description>
      <enclosure url="https://acg.rip/t/355679.torrent" type="application/x-bittorrent"/>
      <torrent:contentLength>875401216</torrent:contentLength>
    </item>
  </channel>
</rss>"#;

        let items = parse_acgrip_rss(mock_xml).unwrap();
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(item.title, "[jibaketa合成] 葬送的芙莉蓮 第二季 - 10 END");
        assert_eq!(item.link, "https://acg.rip/t/355679");
        assert_eq!(item.pub_date, "Fri, 05 Jun 2026 08:15:41 -0700");
        assert_eq!(item.magnet, "https://acg.rip/t/355679.torrent");
        assert_eq!(item.description, "<p>YLJ字幕社 1080P 内封字幕 合集</p>");
    }

    #[test]
    fn 测试_解析acgrip_rss_无效数据() {
        let invalid_xml = "<invalid>";
        let result = parse_acgrip_rss(invalid_xml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to deserialize"));
    }

    #[test]
    fn 测试_解析anibt_rss_模拟数据() {
        let mock_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:anibt="https://anibt.net/xmlns/rss/1.0/">
  <channel>
    <title>Anibt Anime Releases</title>
    <item>
      <title>[喵萌奶茶屋] 葬送的芙莉莲 / Sousou no Frieren - 35 [1080p][简繁日内封字幕]</title>
      <link>https://anibt.net/release/rel_pGPUDY2z9WX_</link>
      <guid isPermaLink="false">rel_pGPUDY2z9WX_</guid>
      <pubDate>Fri, 17 Jul 2026 02:27:06 +0800</pubDate>
      <description><![CDATA[<p>喵萌奶茶屋 1080P 简繁日内封字幕</p>]]></description>
      <anibt:type>anime</anibt:type>
      <anibt:releaseId>rel_pGPUDY2z9WX_</anibt:releaseId>
      <torrent xmlns="https://anibt.moe/xmlns/0.1/">
        <link>https://anibt.net/release/rel_pGPUDY2z9WX_</link>
        <contentLength>123456789</contentLength>
        <pubDate>2026-07-16T18:27:06</pubDate>
        <infohash>6d04d7ee50c873dd71face5fddf6807a0a8a763e</infohash>
        <magneturi>magnet:?xt=urn:btih:6d04d7ee50c873dd71face5fddf6807a0a8a763e&amp;dn=test&amp;tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce</magneturi>
        <filename>test.mkv</filename>
      </torrent>
      <enclosure url="https://anibt.net/api/torrent/rel_pGPUDY2z9WX_.torrent" length="123456789" type="application/x-bittorrent" />
    </item>
  </channel>
</rss>"#;

        let items = parse_anibt_rss(mock_xml).unwrap();
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(
            item.title,
            "[喵萌奶茶屋] 葬送的芙莉莲 / Sousou no Frieren - 35 [1080p][简繁日内封字幕]"
        );
        assert_eq!(item.link, "https://anibt.net/release/rel_pGPUDY2z9WX_");
        assert_eq!(item.pub_date, "Fri, 17 Jul 2026 02:27:06 +0800");
        assert_eq!(
            item.magnet,
            "magnet:?xt=urn:btih:6d04d7ee50c873dd71face5fddf6807a0a8a763e&dn=test&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce"
        );
        assert_eq!(item.description, "<p>喵萌奶茶屋 1080P 简繁日内封字幕</p>");
    }

    #[test]
    fn 测试_解析anibt_rss_无效数据() {
        let invalid_xml = "<invalid>";
        let result = parse_anibt_rss(invalid_xml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to deserialize"));
    }
}
