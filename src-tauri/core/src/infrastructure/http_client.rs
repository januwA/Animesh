use async_trait::async_trait;
use std::sync::Arc;

#[async_trait]
pub trait HttpClient: Send + Sync {
    async fn get(&self, url: &str, proxy: Option<String>) -> Result<String, String>;
    async fn post(
        &self,
        url: &str,
        body: String,
        content_type: Option<String>,
        proxy: Option<String>,
    ) -> Result<String, String>;
}

pub struct ReqwestHttpClient;

#[async_trait]
impl HttpClient for ReqwestHttpClient {
    async fn get(&self, url: &str, proxy: Option<String>) -> Result<String, String> {
        let mut builder = reqwest::Client::builder().user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );

        if let Some(ref proxy_str) = proxy {
            if !proxy_str.trim().is_empty() {
                let reqwest_proxy = reqwest::Proxy::all(proxy_str)
                    .map_err(|e| format!("Invalid proxy URL: {}", e))?;
                builder = builder.proxy(reqwest_proxy);
            }
        }

        let client = builder
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to send GET request: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "GET request returned unsuccessful status code: {}",
                response.status()
            ));
        }

        response
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))
    }

    async fn post(
        &self,
        url: &str,
        body: String,
        content_type: Option<String>,
        proxy: Option<String>,
    ) -> Result<String, String> {
        let mut builder = reqwest::Client::builder().user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );

        if let Some(ref proxy_str) = proxy {
            if !proxy_str.trim().is_empty() {
                let reqwest_proxy = reqwest::Proxy::all(proxy_str)
                    .map_err(|e| format!("Invalid proxy URL: {}", e))?;
                builder = builder.proxy(reqwest_proxy);
            }
        }

        let client = builder
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let mut request = client.post(url);
        if let Some(ct) = content_type {
            request = request.header("Content-Type", ct);
        }
        request = request.body(body);

        let response = request
            .send()
            .await
            .map_err(|e| format!("Failed to send POST request: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "POST request returned unsuccessful status code: {}",
                response.status()
            ));
        }

        response
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))
    }
}

pub struct MockHttpClient {
    // Allows us to configure custom handler or mock responses
    pub get_handler: Arc<dyn Fn(&str, Option<String>) -> Result<String, String> + Send + Sync>,
    pub post_handler: Arc<
        dyn Fn(&str, String, Option<String>, Option<String>) -> Result<String, String>
            + Send
            + Sync,
    >,
}

impl Default for MockHttpClient {
    fn default() -> Self {
        Self {
            get_handler: Arc::new(|_url, _proxy| Ok(String::new())),
            post_handler: Arc::new(|_url, _body, _ct, _proxy| Ok(String::new())),
        }
    }
}

#[async_trait]
impl HttpClient for MockHttpClient {
    async fn get(&self, url: &str, proxy: Option<String>) -> Result<String, String> {
        (self.get_handler)(url, proxy)
    }

    async fn post(
        &self,
        url: &str,
        body: String,
        content_type: Option<String>,
        proxy: Option<String>,
    ) -> Result<String, String> {
        (self.post_handler)(url, body, content_type, proxy)
    }
}
