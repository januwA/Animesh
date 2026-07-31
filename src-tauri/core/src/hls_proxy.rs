use axum::{
    body::Body,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use reqwest::Url;
use serde::Deserialize;
use std::time::Duration;

/// 内嵌流媒体服务器上对外暴露的 IPTV HLS 代理路径。
pub const IPTV_PROXY_PATH: &str = "/iptv-proxy";

/// 上游请求携带的浏览器 User-Agent。部分直播源（如 Cloudflare 防护站点）会拒绝
/// 非浏览器请求（403/连接重置），必须伪装成浏览器才能正常拉流。
const UPSTREAM_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/// HLS 代理所需的运行时状态。
#[derive(Clone)]
pub struct HlsProxyState {
    client: reqwest::Client,
    proxy_base: String,
}

impl HlsProxyState {
    pub fn new(proxy_base: String) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("failed to build hls proxy http client"),
            proxy_base,
        }
    }
}

/// 生成对前端公开的代理基础地址，前端在该地址后追加 `?url=` 即可发起代理请求。
pub fn proxy_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}{IPTV_PROXY_PATH}")
}

#[derive(Deserialize)]
pub struct ProxyQuery {
    pub url: String,
}

/// 代理上游请求：m3u8 清单会被重写为经本代理访问，其余内容（ts 分片、密钥等）透传。
pub async fn proxy_request(
    state: &HlsProxyState,
    query: &ProxyQuery,
    headers: &HeaderMap,
) -> Response {
    let upstream_url = match Url::parse(&query.url) {
        Ok(url) if matches!(url.scheme(), "http" | "https") => url,
        _ => return (StatusCode::BAD_REQUEST, "invalid or unsupported url").into_response(),
    };

    let mut request = state
        .client
        .get(upstream_url.clone())
        .header(header::USER_AGENT, UPSTREAM_USER_AGENT);
    if let Some(range) = headers.get(header::RANGE).and_then(|v| v.to_str().ok()) {
        request = request.header(header::RANGE, range);
    }

    let upstream = match request.send().await {
        Ok(response) => response,
        Err(err) => {
            log::error!("iptv proxy upstream request failed for {upstream_url}: {err}");
            return (
                StatusCode::BAD_GATEWAY,
                format!("upstream request failed: {err}"),
            )
                .into_response();
        }
    };

    let is_manifest = upstream
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|content_type| {
            let lower = content_type.to_lowercase();
            lower.contains("mpegurl") || lower.contains("hls")
        })
        .unwrap_or(false);

    if is_manifest {
        let final_url = upstream.url().clone();
        let bytes = match upstream.bytes().await {
            Ok(bytes) => bytes,
            Err(_) => {
                return (StatusCode::BAD_GATEWAY, "failed to read manifest").into_response();
            }
        };
        let rewritten = rewrite_hls_manifest(&bytes, &final_url, &state.proxy_base);
        return (
            [
                (
                    header::CONTENT_TYPE,
                    "application/vnd.apple.mpegurl".to_string(),
                ),
                (header::CACHE_CONTROL, "no-cache".to_string()),
            ],
            rewritten,
        )
            .into_response();
    }

    let mut response_headers = HeaderMap::new();
    for key in [
        header::CONTENT_TYPE,
        header::CONTENT_LENGTH,
        header::CONTENT_RANGE,
        header::ACCEPT_RANGES,
    ] {
        if let Some(value) = upstream.headers().get(&key) {
            response_headers.insert(key, value.clone());
        }
    }

    (
        upstream.status(),
        response_headers,
        Body::from_stream(upstream.bytes_stream()),
    )
        .into_response()
}

/// 重写 m3u8 清单，把所有子资源 URI（分片、子清单、密钥）改写为经本代理访问的地址。
fn rewrite_hls_manifest(body: &[u8], manifest_url: &Url, proxy_base: &str) -> String {
    let text = String::from_utf8_lossy(body);
    let mut out = String::with_capacity(text.len() + 256);
    for line in text.lines() {
        if line.trim().is_empty() {
            out.push('\n');
        } else if let Some(rest) = line.strip_prefix('#') {
            out.push('#');
            if line.contains("URI=") {
                out.push_str(&rewrite_uri_attributes(rest, manifest_url, proxy_base));
            } else {
                out.push_str(rest);
            }
            out.push('\n');
        } else {
            out.push_str(&proxy_uri(line, manifest_url, proxy_base));
            out.push('\n');
        }
    }
    out
}

/// 重写单行 URI 为代理地址；解析失败时保留原文。
fn proxy_uri(raw: &str, base: &Url, proxy_base: &str) -> String {
    match base.join(raw) {
        Ok(resolved) => {
            format!(
                "{proxy_base}?url={}",
                urlencoding::encode(resolved.as_str())
            )
        }
        Err(_) => raw.to_string(),
    }
}

/// 重写行内所有 `URI="..."` 属性的值（如 EXT-X-KEY、EXT-X-MAP、EXT-X-MEDIA）。
fn rewrite_uri_attributes(line: &str, base: &Url, proxy_base: &str) -> String {
    let mut out = String::with_capacity(line.len() + 64);
    let mut remaining = line;
    while let Some(pos) = remaining.find("URI=") {
        out.push_str(&remaining[..pos + 4]);
        remaining = &remaining[pos + 4..];
        match remaining.strip_prefix('"') {
            Some(rest) => {
                out.push('"');
                if let Some(end) = rest.find('"') {
                    let value = &rest[..end];
                    out.push_str(&proxy_uri(value, base, proxy_base));
                    out.push('"');
                    remaining = &rest[end + 1..];
                } else {
                    out.push_str(rest);
                    remaining = "";
                }
            }
            None => {
                out.push_str(remaining);
                remaining = "";
            }
        }
    }
    out.push_str(remaining);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::to_bytes, routing::get, Router};
    use std::net::SocketAddr;
    use tokio::net::TcpListener;

    const PROXY_BASE: &str = "http://127.0.0.1:9999/iptv-proxy";

    fn test_state() -> HlsProxyState {
        HlsProxyState::new(PROXY_BASE.to_string())
    }

    async fn spawn_upstream(routes: Router) -> SocketAddr {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, routes).await.unwrap();
        });
        addr
    }

    async fn body_of(response: Response) -> (StatusCode, String) {
        let status = response.status();
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        (status, String::from_utf8(bytes.to_vec()).unwrap())
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_生成代理基础地址() {
        assert_eq!(proxy_base_url(12345), "http://127.0.0.1:12345/iptv-proxy");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写清单_相对分片与标签() {
        let base = Url::parse("http://example.com/live/playlist.m3u8").unwrap();
        let body = "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10.0,\nseg.ts\n#EXT-X-ENDLIST\n";
        let rewritten = rewrite_hls_manifest(body.as_bytes(), &base, PROXY_BASE);
        assert_eq!(
            rewritten,
            "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10.0,\nhttp://127.0.0.1:9999/iptv-proxy?url=http%3A%2F%2Fexample.com%2Flive%2Fseg.ts\n#EXT-X-ENDLIST\n"
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写清单_绝对地址与密钥URI属性() {
        let base = Url::parse("http://example.com/live/playlist.m3u8").unwrap();
        let body =
            "#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\nhttp://cdn.example.com/a.ts\n";
        let rewritten = rewrite_hls_manifest(body.as_bytes(), &base, PROXY_BASE);
        assert!(rewritten.contains(
            "URI=\"http://127.0.0.1:9999/iptv-proxy?url=http%3A%2F%2Fexample.com%2Flive%2Fkey.bin\""
        ));
        assert!(rewritten
            .contains("http://127.0.0.1:9999/iptv-proxy?url=http%3A%2F%2Fcdn.example.com%2Fa.ts"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写清单_空行与无引号URI边界() {
        let base = Url::parse("http://example.com/playlist.m3u8").unwrap();
        let body = "#EXTM3U\n\n#EXT-X-KEY:METHOD=AES-128,URI=plain\n#EXT-X-MEDIA:TYPE=AUDIO,URI=\"a.m3u8\",GROUP-ID=\"aud\"\n";
        let rewritten = rewrite_hls_manifest(body.as_bytes(), &base, PROXY_BASE);
        assert!(rewritten.contains("\n\n"));
        assert!(rewritten.contains("URI=plain"));
        assert!(rewritten.contains("URI=\"http://127.0.0.1:9999/iptv-proxy?url="));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写URI_无法解析时保留原样() {
        let base = Url::parse("http://example.com/playlist.m3u8").unwrap();
        assert_eq!(
            proxy_uri("http://host:abc/seg.ts", &base, PROXY_BASE),
            "http://host:abc/seg.ts"
        );
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_清单请求返回重写后的清单() {
        let addr = spawn_upstream(Router::new().route(
            "/live.m3u8",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                    "#EXTM3U\n#EXTINF:10.0,\nseg.ts\n",
                )
            }),
        ))
        .await;
        let query = ProxyQuery {
            url: format!("http://{addr}/live.m3u8"),
        };
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        let expected = format!(
            "?url={}",
            urlencoding::encode(&format!("http://{addr}/seg.ts"))
        );
        assert!(text.contains(&expected));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_跟随302跳转后按最终地址重写() {
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/entry.m3u8",
                    get(|| async { (StatusCode::FOUND, [("location", "/final.m3u8")]) }),
                )
                .route(
                    "/final.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/x-mpegURL")],
                            "#EXTM3U\nfinal.ts\n",
                        )
                    }),
                ),
        )
        .await;
        let query = ProxyQuery {
            url: format!("http://{addr}/entry.m3u8"),
        };
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        let expected = format!(
            "?url={}",
            urlencoding::encode(&format!("http://{addr}/final.ts"))
        );
        assert!(text.contains(&expected));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_二进制分片透传() {
        let addr = spawn_upstream(Router::new().route(
            "/seg.ts",
            get(|| async {
                (
                    [
                        (header::CONTENT_TYPE, "video/mp2t"),
                        (header::CONTENT_LENGTH, "5"),
                    ],
                    vec![0u8, 1, 2, 3, 4],
                )
            }),
        ))
        .await;
        let query = ProxyQuery {
            url: format!("http://{addr}/seg.ts"),
        };
        let response = proxy_request(&test_state(), &query, &HeaderMap::new()).await;
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert_eq!(bytes.as_ref(), &[0u8, 1, 2, 3, 4]);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_转发Range头() {
        let addr = spawn_upstream(Router::new().route(
            "/echo",
            get(|headers: HeaderMap| async move {
                let range = headers
                    .get(header::RANGE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                ([(header::CONTENT_TYPE, "application/octet-stream")], range)
            }),
        ))
        .await;
        let query = ProxyQuery {
            url: format!("http://{addr}/echo"),
        };
        let mut headers = HeaderMap::new();
        headers.insert(header::RANGE, "bytes=0-99".parse().unwrap());
        let (status, text) = body_of(proxy_request(&test_state(), &query, &headers).await).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "bytes=0-99");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_上游错误状态透传() {
        let addr = spawn_upstream(Router::new().route(
            "/broken",
            get(|| async { StatusCode::INTERNAL_SERVER_ERROR }),
        ))
        .await;
        let query = ProxyQuery {
            url: format!("http://{addr}/broken"),
        };
        let response = proxy_request(&test_state(), &query, &HeaderMap::new()).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_非法URL_返回400() {
        let query = ProxyQuery {
            url: "not-a-url".to_string(),
        };
        let (status, _) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_非http协议_返回400() {
        let query = ProxyQuery {
            url: "ftp://example.com/live.m3u8".to_string(),
        };
        let (status, _) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_上游请求携带浏览器UserAgent() {
        let addr = spawn_upstream(Router::new().route(
            "/ua",
            get(|headers: HeaderMap| async move {
                headers
                    .get(header::USER_AGENT)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string()
            }),
        ))
        .await;
        let query = ProxyQuery {
            url: format!("http://{addr}/ua"),
        };
        let (status, body) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.starts_with("Mozilla/5.0"), "实际 UA: {body}");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_上游连接失败_返回502() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        drop(listener);

        let query = ProxyQuery {
            url: format!("http://{addr}/live.m3u8"),
        };
        let (status, body) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert!(body.contains("upstream request failed"));
    }
}
