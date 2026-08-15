use crate::error::{CoreError, CoreResult};
use async_trait::async_trait;
use std::sync::Arc;

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
         (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[async_trait]
pub trait HttpClient: Send + Sync {
    async fn get(&self, url: &str, proxy: Option<String>) -> CoreResult<String>;
    async fn post(
        &self,
        url: &str,
        body: String,
        content_type: Option<String>,
        proxy: Option<String>,
    ) -> CoreResult<String>;
}

pub struct ReqwestHttpClient;

#[async_trait]
impl HttpClient for ReqwestHttpClient {
    async fn get(&self, url: &str, proxy: Option<String>) -> CoreResult<String> {
        let client = build_client(proxy.as_deref())?;

        let response = client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(CoreError::Message(format!(
                "GET request returned unsuccessful status code: {}",
                response.status()
            )));
        }

        Ok(response.text().await?)
    }

    async fn post(
        &self,
        url: &str,
        body: String,
        content_type: Option<String>,
        proxy: Option<String>,
    ) -> CoreResult<String> {
        let client = build_client(proxy.as_deref())?;

        let mut request = client.post(url);
        if let Some(ct) = content_type {
            request = request.header("Content-Type", ct);
        }
        request = request.body(body);

        let response = request.send().await?;

        if !response.status().is_success() {
            return Err(CoreError::Message(format!(
                "POST request returned unsuccessful status code: {}",
                response.status()
            )));
        }

        Ok(response.text().await?)
    }
}

fn build_client(proxy: Option<&str>) -> CoreResult<reqwest::Client> {
    let mut builder = reqwest::Client::builder().user_agent(USER_AGENT);

    if let Some(proxy_str) = proxy {
        if !proxy_str.trim().is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(proxy_str)?);
        }
    }

    Ok(builder.build()?)
}

#[allow(clippy::type_complexity)]
pub struct MockHttpClient {
    // Allows us to configure custom handler or mock responses
    pub get_handler: Arc<dyn Fn(&str, Option<String>) -> CoreResult<String> + Send + Sync>,
    pub post_handler: Arc<
        dyn Fn(&str, String, Option<String>, Option<String>) -> CoreResult<String> + Send + Sync,
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
    async fn get(&self, url: &str, proxy: Option<String>) -> CoreResult<String> {
        (self.get_handler)(url, proxy)
    }

    async fn post(
        &self,
        url: &str,
        body: String,
        content_type: Option<String>,
        proxy: Option<String>,
    ) -> CoreResult<String> {
        (self.post_handler)(url, body, content_type, proxy)
    }
}

/// 封装并代发 AI 聊天请求的公共辅助函数，隐藏 reqwest 细节。
pub async fn send_ai_chat_request(
    endpoint: &str,
    api_key: &str,
    body_json: &str,
) -> CoreResult<String> {
    let client = reqwest::Client::new();
    let mut req = client
        .post(endpoint)
        .header("Content-Type", "application/json");

    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let res = req.body(body_json.to_string()).send().await?;

    let status = res.status();
    let text = res.text().await?;

    if !status.is_success() {
        return Err(CoreError::Message(format!(
            "HTTP error status {}: {}",
            status, text
        )));
    }

    Ok(text)
}
