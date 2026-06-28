use crate::crawler::{
    parse_bangumi_moe_json, parse_dmhy_rss, parse_mikan_rss, parse_nyaa_rss, SearchResultItem,
};
use urlencoding::encode;

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

pub async fn search_nyaa(
    keyword: &str,
    proxy: Option<String>,
) -> Result<Vec<SearchResultItem>, String> {
    let encoded_keyword = encode(keyword);
    let url = format!("https://nyaa.si/?page=rss&q={}&c=0_0&f=0", encoded_keyword);

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
        .map_err(|e| format!("Failed to send search request to Nyaa: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Nyaa returned unsuccessful status code: {}",
            response.status()
        ));
    }

    let xml_data = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    parse_nyaa_rss(&xml_data)
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[tokio::test]
    async fn test_search_mikan_integration() {
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

    #[tokio::test]
    async fn 测试_nyaa_搜索集成测试() {
        let results = search_nyaa("凡人", None).await;
        let items = match results {
            Ok(items) => items,
            Err(e) => {
                println!(
                    "Skipping nyaa integration test due to network/timeout: {}",
                    e
                );
                return;
            }
        };
        assert!(!items.is_empty(), "Nyaa search should return some results");
        assert!(
            items[0].title.to_lowercase().contains("凡人")
                || items[0].title.to_lowercase().contains("mortal")
        );
        assert!(items[0].magnet.starts_with("magnet:?xt=urn:btih:"));
    }

    #[tokio::test]
    async fn 测试_search_mikan_无效代理() {
        let result = search_mikan("凡人", Some("://bad".to_string())).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid proxy"));
    }

    #[tokio::test]
    async fn 测试_search_nyaa_无效代理() {
        let result = search_nyaa("凡人", Some("://bad".to_string())).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid proxy"));
    }
}
