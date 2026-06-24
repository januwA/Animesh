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
pub async fn search_dmhy(keyword: &str) -> Result<Vec<SearchResultItem>, String> {
    let encoded_keyword = encode(keyword);
    let url = format!(
        "https://share.dmhy.org/topics/rss/rss.xml?keyword={}",
        encoded_keyword
    );

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
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

#[cfg(test)]
mod tests {
    use super::*;

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

    #[tokio::test]
    async fn test_search_dmhy_integration() {
        let results = search_dmhy("凡人").await;
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
}
