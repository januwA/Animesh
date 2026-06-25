use serde::{Deserialize, Serialize};
use urlencoding::encode;

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

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct SearchResultItem {
    pub title: String,
    pub link: String,
    pub pub_date: String,
    pub magnet: String,
    pub size: Option<u64>,
}

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

/// Search DMHY (动漫花园) RSS for a keyword
pub async fn search_dmhy(
    keyword: &str,
    proxy: Option<String>,
) -> Result<Vec<SearchResultItem>, String> {
    let encoded_keyword = encode(keyword);
    let url = format!(
        "https://share.dmhy.org/topics/rss/rss.xml?keyword={}",
        encoded_keyword
    );

    let mut builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    if let Some(ref proxy_str) = proxy {
        if !proxy_str.trim().is_empty() {
            let reqwest_proxy =
                reqwest::Proxy::all(proxy_str).map_err(|e| format!("Invalid proxy URL: {}", e))?;
            builder = builder.proxy(reqwest_proxy);
        }
    }

    let client = builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to send search request to DMHY: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "DMHY returned unsuccessful status code: {}",
            response.status()
        ));
    }

    let xml_data = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    parse_dmhy_rss(&xml_data)
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
        "KB" | "K" => 1024.0,
        "MB" | "M" => 1024.0 * 1024.0,
        "GB" | "G" => 1024.0 * 1024.0 * 1024.0,
        "TB" | "T" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
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

pub async fn search_bangumi_moe(
    keyword: &str,
    proxy: Option<String>,
) -> Result<Vec<SearchResultItem>, String> {
    let mut builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    if let Some(ref proxy_str) = proxy {
        if !proxy_str.trim().is_empty() {
            let reqwest_proxy =
                reqwest::Proxy::all(proxy_str).map_err(|e| format!("Invalid proxy URL: {}", e))?;
            builder = builder.proxy(reqwest_proxy);
        }
    }

    let client = builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let payload = serde_json::json!({
        "query": keyword
    });
    let body_str = serde_json::to_string(&payload).unwrap();

    let response = client
        .post("https://bangumi.moe/api/v2/torrent/search")
        .header("Content-Type", "text/plain;charset=UTF-8")
        .body(body_str)
        .send()
        .await
        .map_err(|e| format!("Failed to send search request to Bangumi.moe: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Bangumi.moe returned unsuccessful status code: {}",
            response.status()
        ));
    }

    let json_data = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    parse_bangumi_moe_json(&json_data)
}

fn extract_hash_from_url(url: &str) -> Option<String> {
    if let Some(last_segment) = url.split('/').last() {
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

pub async fn search_mikan(
    keyword: &str,
    proxy: Option<String>,
) -> Result<Vec<SearchResultItem>, String> {
    let encoded_keyword = encode(keyword);
    let url = format!(
        "https://mikanani.me/RSS/Search?searchstr={}",
        encoded_keyword
    );

    let mut builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    if let Some(ref proxy_str) = proxy {
        if !proxy_str.trim().is_empty() {
            let reqwest_proxy =
                reqwest::Proxy::all(proxy_str).map_err(|e| format!("Invalid proxy URL: {}", e))?;
            builder = builder.proxy(reqwest_proxy);
        }
    }

    let client = builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to send search request to Mikan: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Mikan returned unsuccessful status code: {}",
            response.status()
        ));
    }

    let xml_data = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    parse_mikan_rss(&xml_data)
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
    }

    #[test]
    fn test_parse_bangumi_moe_json_mock() {
        let mock_json = r#"{
            "torrents": [
                {
                    "_id": "6a38a56aa9616b2639aa281d",
                    "title": "[黒ネズミたち] 凡人修仙传 EP 179",
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
        assert_eq!(item.title, "[黒ネズミたち] 凡人修仙传 EP 179");
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
    <title>动漫花园 -- 凡人</title>
    <item>
      <title>[神楽坂 まひろ] 凡人修仙传 - 9 (1080P HEVC MKV)</title>
      <link>http://share.dmhy.org/topics/view/635711.html</link>
      <pubDate>Mon, 23 Jun 2026 12:00:00 +0800</pubDate>
      <enclosure url="magnet:?xt=urn:btih:TESTMAGNET" length="350000000" type="application/x-bittorrent" />
    </item>
  </channel>
</rss>"#;

        let items = parse_dmhy_rss(mock_xml).unwrap();
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(
            item.title,
            "[神楽坂 まひろ] 凡人修仙传 - 9 (1080P HEVC MKV)"
        );
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

    #[tokio::test]
    async fn test_search_dmhy_invalid_proxy() {
        let result = search_dmhy("凡人", Some("://bad".to_string())).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid proxy"));
    }

    #[tokio::test]
    async fn test_search_bangumi_moe_invalid_proxy() {
        let result = search_bangumi_moe("凡人", Some("://bad".to_string())).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid proxy"));
    }

    #[tokio::test]
    async fn test_search_dmhy_integration() {
        let results = search_dmhy("凡人", None).await;
        let items = match results {
            Ok(items) => items,
            Err(e) => {
                println!("Skipping integration test due to network/timeout: {}", e);
                return;
            }
        };
        assert!(!items.is_empty(), "Search should return some results");

        // Print the first item for debugging
        println!("First item: {:?}", items[0]);
        assert!(items[0].title.contains("凡人"));
        assert!(items[0].magnet.starts_with("magnet:?xt=urn:btih:"));
    }

    #[tokio::test]
    async fn test_search_bangumi_moe_integration() {
        let results = search_bangumi_moe("凡人", None).await;
        let items = match results {
            Ok(items) => items,
            Err(e) => {
                println!(
                    "Skipping bangumi.moe integration test due to network/timeout: {}",
                    e
                );
                return;
            }
        };
        assert!(!items.is_empty(), "Search should return some results");
        println!("First item from bangumi.moe: {:?}", items[0]);
        assert!(items[0].title.contains("凡人"));
        assert!(items[0].magnet.starts_with("magnet:?xt=urn:btih:"));
    }

    #[test]
    fn 测试_解析mikan_rss_模拟数据() {
        let mock_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Mikan Project - 搜索结果:凡人修仙</title>
    <item>
      <title>[黒ネズミたち] 凡人修仙传 - 179</title>
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
        assert_eq!(item.title, "[黒ネズミたち] 凡人修仙传 - 179");
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

    #[tokio::test]
    async fn 测试_mikan_搜索集成测试() {
        let results = search_mikan("凡人", None).await;
        let items = match results {
            Ok(items) => items,
            Err(e) => {
                println!(
                    "Skipping mikan integration test due to network/timeout: {}",
                    e
                );
                return;
            }
        };
        assert!(!items.is_empty(), "Mikan search should return some results");
        assert!(items[0].title.contains("凡人"));
        assert!(items[0].magnet.starts_with("magnet:?xt=urn:btih:"));
    }
}
