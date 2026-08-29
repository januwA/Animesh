use crate::domain::settings::SettingsRepository;
use crate::error::CoreResult;
use crate::infrastructure::http_client::HttpClient;
use std::sync::Arc;

/// AI 聊天请求用例：封装大模型 API 调用，支持 proxy 与自定义 headers。
pub struct AiChatUseCase {
    http_client: Arc<dyn HttpClient>,
    settings_repo: Arc<dyn SettingsRepository>,
}

impl AiChatUseCase {
    pub fn new(
        http_client: Arc<dyn HttpClient>,
        settings_repo: Arc<dyn SettingsRepository>,
    ) -> Self {
        Self {
            http_client,
            settings_repo,
        }
    }

    pub async fn execute(
        &self,
        endpoint: &str,
        api_key: &str,
        body_json: &str,
    ) -> CoreResult<String> {
        let proxy = self.settings_repo.get_proxy().await?;

        let mut headers = vec![("Content-Type".into(), "application/json".into())];
        if !api_key.is_empty() {
            headers.push(("Authorization".into(), format!("Bearer {}", api_key)));
        }

        self.http_client
            .post(endpoint, body_json.to_string(), None, Some(headers), proxy)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::http_client::MockHttpClient;
    use crate::infrastructure::test_mocks::MockSettingsRepository;
    use std::sync::Arc;

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_execute_带api_key添加Authorization头() {
        let captured = Arc::new(std::sync::Mutex::new(None::<Vec<(String, String)>>));

        let captured_clone = captured.clone();
        let mock_client = MockHttpClient {
            post_handler: Arc::new(move |_url, body, _ct, headers, _proxy| {
                *captured_clone.lock().unwrap() = headers;
                Ok(body)
            }),
            ..Default::default()
        };

        let settings_repo = Arc::new(MockSettingsRepository::default());
        let use_case = AiChatUseCase::new(Arc::new(mock_client), settings_repo);

        let result = use_case
            .execute(
                "https://api.example.com/chat",
                "test-key",
                r#"{"msg":"hi"}"#,
            )
            .await
            .unwrap();

        assert_eq!(result, r#"{"msg":"hi"}"#);

        let headers = captured.lock().unwrap().clone().unwrap();
        assert!(headers
            .iter()
            .any(|(k, v)| k == "Authorization" && v == "Bearer test-key"));
        assert!(headers
            .iter()
            .any(|(k, v)| k == "Content-Type" && v == "application/json"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_execute_空api_key不添加Authorization头() {
        let captured = Arc::new(std::sync::Mutex::new(None::<Vec<(String, String)>>));

        let captured_clone = captured.clone();
        let mock_client = MockHttpClient {
            post_handler: Arc::new(move |_url, _body, _ct, headers, _proxy| {
                *captured_clone.lock().unwrap() = headers;
                Ok(String::new())
            }),
            ..Default::default()
        };

        let settings_repo = Arc::new(MockSettingsRepository::default());
        let use_case = AiChatUseCase::new(Arc::new(mock_client), settings_repo);

        let _ = use_case
            .execute("https://api.example.com/chat", "", "{}")
            .await;

        let headers = captured.lock().unwrap().clone().unwrap();
        assert!(!headers.iter().any(|(k, _)| k == "Authorization"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_execute_传递proxy配置() {
        let captured_proxy = Arc::new(std::sync::Mutex::new(None::<Option<String>>));

        let captured_clone = captured_proxy.clone();
        let mock_client = MockHttpClient {
            post_handler: Arc::new(move |_url, _body, _ct, _headers, proxy| {
                *captured_clone.lock().unwrap() = Some(proxy);
                Ok(String::new())
            }),
            ..Default::default()
        };

        let settings_repo = Arc::new(MockSettingsRepository {
            proxy: Some("http://127.0.0.1:7890".into()),
            ..Default::default()
        });
        let use_case = AiChatUseCase::new(Arc::new(mock_client), settings_repo);

        let _ = use_case
            .execute("https://api.example.com/chat", "", "{}")
            .await;

        let proxy = captured_proxy.lock().unwrap().clone().unwrap();
        assert_eq!(proxy, Some("http://127.0.0.1:7890".to_string()));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_execute_get_proxy失败时透传错误() {
        let mock_client = MockHttpClient::default();
        let settings_repo = Arc::new(MockSettingsRepository {
            get_proxy_error: Some("数据库连接失败".into()),
            ..Default::default()
        });
        let use_case = AiChatUseCase::new(Arc::new(mock_client), settings_repo);

        let err = use_case
            .execute("https://api.example.com/chat", "", "{}")
            .await
            .unwrap_err();
        assert!(err.to_string().contains("数据库连接失败"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_execute_http_post失败时透传错误() {
        let mock_client = MockHttpClient {
            post_handler: Arc::new(|_, _, _, _, _| Err("网络超时".into())),
            ..Default::default()
        };
        let settings_repo = Arc::new(MockSettingsRepository::default());
        let use_case = AiChatUseCase::new(Arc::new(mock_client), settings_repo);

        let err = use_case
            .execute("https://api.example.com/chat", "key", "{}")
            .await
            .unwrap_err();
        assert!(err.to_string().contains("网络超时"));
    }
}
