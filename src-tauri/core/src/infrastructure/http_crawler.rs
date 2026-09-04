use crate::domain::crawler::{CrawlerRepository, SearchResultItem};
use crate::error::CoreError;
use crate::infrastructure::crawler_parsers::{
    parse_acgrip_rss, parse_anibt_rss, parse_bangumi_moe_json, parse_dmhy_rss, parse_mikan_rss,
    parse_nyaa_rss,
};
use crate::infrastructure::http_client::HttpClient;
use async_trait::async_trait;
use std::sync::Arc;
use urlencoding::encode;

/// 构建默认的爬虫仓储（真实 HTTP 客户端），由组合根调用。
pub fn create_crawler_repository() -> Arc<dyn CrawlerRepository> {
    let client = Arc::new(crate::infrastructure::http_client::ReqwestHttpClient);
    Arc::new(HttpCrawlerRepository::new(client))
}

pub struct HttpCrawlerRepository {
    client: Arc<dyn HttpClient>,
}

impl HttpCrawlerRepository {
    pub fn new(client: Arc<dyn HttpClient>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl CrawlerRepository for HttpCrawlerRepository {
    async fn search_dmhy(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError> {
        let encoded_keyword = encode(keyword);
        let url = format!(
            "https://share.dmhy.org/topics/rss/rss.xml?keyword={}",
            encoded_keyword
        );

        let xml_data = self.client.get(&url, proxy).await?;
        parse_dmhy_rss(&xml_data)
    }

    async fn search_bangumi_moe(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError> {
        let payload = serde_json::json!({
            "query": keyword
        });
        let body_str = serde_json::to_string(&payload).unwrap();

        let json_data = self
            .client
            .post(
                "https://bangumi.moe/api/v2/torrent/search",
                body_str,
                Some("text/plain;charset=UTF-8".to_string()),
                None,
                proxy,
            )
            .await?;

        parse_bangumi_moe_json(&json_data)
    }

    async fn search_mikan(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError> {
        let encoded_keyword = encode(keyword);
        let url = format!(
            "https://mikanani.me/RSS/Search?searchstr={}",
            encoded_keyword
        );

        let xml_data = self.client.get(&url, proxy).await?;
        parse_mikan_rss(&xml_data)
    }

    async fn search_nyaa(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError> {
        let encoded_keyword = encode(keyword);
        let url = format!("https://nyaa.si/?page=rss&q={}&c=0_0&f=0", encoded_keyword);

        let xml_data = self.client.get(&url, proxy).await?;
        parse_nyaa_rss(&xml_data)
    }

    async fn search_acgrip(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError> {
        let encoded_keyword = encode(keyword);
        let url = format!("https://acg.rip/.xml?term={}", encoded_keyword);

        let xml_data = self.client.get(&url, proxy).await?;
        parse_acgrip_rss(&xml_data)
    }

    async fn search_anibt(
        &self,
        keyword: &str,
        proxy: Option<String>,
    ) -> Result<Vec<SearchResultItem>, CoreError> {
        let encoded_keyword = encode(keyword);
        let url = format!("https://anibt.net/rss/magnets.xml?q={}", encoded_keyword);

        let xml_data = self.client.get(&url, proxy).await?;
        parse_anibt_rss(&xml_data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::http_client::MockHttpClient;

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_dmhy_错误代理和异常处理() {
        let mock_client = MockHttpClient {
            get_handler: Arc::new(|_url, proxy| {
                if let Some(p) = proxy {
                    if p.contains("://bad") {
                        return Err("Invalid proxy".to_string().into());
                    }
                }
                Ok(String::new())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let result = repo.search_dmhy("xxx", Some("://bad".to_string())).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid proxy"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_bangumi_moe_错误代理和异常处理() {
        let mock_client = MockHttpClient {
            post_handler: Arc::new(|_url, _body, _ct, _headers, proxy| {
                if let Some(p) = proxy {
                    if p.contains("://bad") {
                        return Err("Invalid proxy".to_string().into());
                    }
                }
                Ok(String::new())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let result = repo
            .search_bangumi_moe("xxx", Some("://bad".to_string()))
            .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid proxy"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_dmhy_使用MockHttpClient不发起真实网络() {
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

        let mock_client = MockHttpClient {
            get_handler: Arc::new(move |url, _proxy| {
                assert!(url.contains("rss.xml"));
                assert!(url.contains("keyword=xxx"));
                Ok(mock_xml.to_string())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let results = repo.search_dmhy("xxx", None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "[神楽坂 まひろ] xxx - 9 (1080P HEVC MKV)");
        assert_eq!(results[0].magnet, "magnet:?xt=urn:btih:TESTMAGNET");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_bangumi_moe_使用MockHttpClient() {
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

        let mock_client = MockHttpClient {
            post_handler: Arc::new(move |url, body, content_type, _headers, _proxy| {
                assert_eq!(url, "https://bangumi.moe/api/v2/torrent/search");
                assert_eq!(content_type, Some("text/plain;charset=UTF-8".to_string()));
                assert!(body.contains("xxx"));
                Ok(mock_json.to_string())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let results = repo.search_bangumi_moe("xxx", None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "[黒ネズミたち] xxx EP 179");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_mikan_使用MockHttpClient() {
        let mock_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Mikan Project</title>
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

        let mock_client = MockHttpClient {
            get_handler: Arc::new(move |url, _proxy| {
                assert!(url.contains("RSS/Search"));
                Ok(mock_xml.to_string())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let results = repo.search_mikan("xxx", None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "[黒ネズミたち] xxx - 179");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_nyaa_使用MockHttpClient() {
        let mock_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:nyaa="https://nyaa.si/xmlns/nyaa" version="2.0">
  <channel>
    <title>Nyaa</title>
    <item>
      <title>[FSP DN] A Record of a Mortal’s Journey to Immortality - 179 (1080p)</title>
      <link>https://nyaa.si/download/2123662.torrent</link>
      <guid isPermaLink="true">https://nyaa.si/view/2123662</guid>
      <pubDate>Sat, 20 Jun 2026 14:23:11 -0000</pubDate>
      <nyaa:infoHash>02884c75f52f499ba9eafb31004526bfd7ec8c1b</nyaa:infoHash>
      <nyaa:size>438.3 MiB</nyaa:size>
    </item>
  </channel>
</rss>"#;

        let mock_client = MockHttpClient {
            get_handler: Arc::new(move |url, _proxy| {
                assert!(url.contains("nyaa.si"));
                Ok(mock_xml.to_string())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let results = repo.search_nyaa("xxx", None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0].title,
            "[FSP DN] A Record of a Mortal’s Journey to Immortality - 179 (1080p)"
        );
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_acgrip_使用MockHttpClient() {
        let mock_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torrent="http://xmlns.ezrss.it/0.1/">
  <channel>
    <title>ACG.RIP</title>
    <item>
      <title>[jibaketa合成] xxx - 10 END</title>
      <link>https://acg.rip/t/355679</link>
      <pubDate>Fri, 05 Jun 2026 08:15:41 -0700</pubDate>
      <enclosure url="https://acg.rip/t/355679.torrent" type="application/x-bittorrent"/>
      <torrent:contentLength>875401216</torrent:contentLength>
    </item>
  </channel>
</rss>"#;

        let mock_client = MockHttpClient {
            get_handler: Arc::new(move |url, _proxy| {
                assert!(url.contains("acg.rip"));
                assert!(url.contains("term=xxx"));
                Ok(mock_xml.to_string())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let results = repo.search_acgrip("xxx", None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "[jibaketa合成] xxx - 10 END");
        assert_eq!(results[0].magnet, "https://acg.rip/t/355679.torrent");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_search_anibt_使用MockHttpClient() {
        let mock_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:anibt="https://anibt.net/xmlns/rss/1.0/">
  <channel>
    <title>Anibt Anime Releases</title>
    <item>
      <title>[喵萌奶茶屋] xxx - 35 [1080p]</title>
      <link>https://anibt.net/release/rel_pGPUDY2z9WX_</link>
      <pubDate>Fri, 17 Jul 2026 02:27:06 +0800</pubDate>
      <torrent xmlns="https://anibt.moe/xmlns/0.1/">
        <contentLength>123456789</contentLength>
        <infohash>6d04d7ee50c873dd71face5fddf6807a0a8a763e</infohash>
        <magneturi>magnet:?xt=urn:btih:6d04d7ee50c873dd71face5fddf6807a0a8a763e</magneturi>
      </torrent>
    </item>
  </channel>
</rss>"#;

        let mock_client = MockHttpClient {
            get_handler: Arc::new(move |url, _proxy| {
                assert!(url.contains("anibt.net"));
                assert!(url.contains("q=xxx"));
                Ok(mock_xml.to_string())
            }),
            ..Default::default()
        };

        let repo = HttpCrawlerRepository::new(Arc::new(mock_client));
        let results = repo.search_anibt("xxx", None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "[喵萌奶茶屋] xxx - 35 [1080p]");
        assert_eq!(
            results[0].magnet,
            "magnet:?xt=urn:btih:6d04d7ee50c873dd71face5fddf6807a0a8a763e"
        );
    }
}
