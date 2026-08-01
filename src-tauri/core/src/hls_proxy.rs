use axum::{
    body::Body,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use m3u8_rs::{Playlist, SessionDataField};
use reqwest::{Response as UpstreamResponse, Url};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// 内嵌流媒体服务器上对外暴露的 IPTV HLS 代理路径。
pub const IPTV_PROXY_PATH: &str = "/iptv-proxy";

/// 上游请求携带的浏览器 User-Agent。部分直播源（如 Cloudflare 防护站点）会拒绝
/// 非浏览器请求（403/连接重置），必须伪装成浏览器才能正常拉流。
const UPSTREAM_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/// 分片/子资源的最大缓冲上限。超限时退化为流式透传。
const MAX_BUFFER_SIZE: usize = 64 * 1024 * 1024;

/// 重定向缓存有效期：覆盖 CDN 签名地址的常见过期周期（分钟级）。
const REDIRECT_CACHE_TTL: Duration = Duration::from_secs(600);

/// 缓存一条 `原始URL -> 最终URL` 的映射，用于直播清单重拉取时应对签名地址过期。
#[derive(Clone)]
struct RedirectEntry {
    final_url: String,
    updated_at: Instant,
}

/// HLS 代理所需的运行时状态。
#[derive(Clone)]
pub struct HlsProxyState {
    client: reqwest::Client,
    proxy_base: String,
    redirect_cache: Arc<Mutex<HashMap<String, RedirectEntry>>>,
}

impl HlsProxyState {
    pub fn new(proxy_base: String) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .connect_timeout(Duration::from_secs(10))
                .cookie_store(true)
                .build()
                .expect("failed to build hls proxy http client"),
            proxy_base,
            redirect_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 记录 `original` 请求最终跳转到的地址，并清理过期条目。
    fn cache_update(&self, original: &str, final_url: &Url) {
        let mut cache = match self.redirect_cache.lock() {
            Ok(cache) => cache,
            Err(poisoned) => poisoned.into_inner(),
        };
        cache.retain(|_, entry| entry.updated_at.elapsed() < REDIRECT_CACHE_TTL);
        cache.insert(
            original.to_string(),
            RedirectEntry {
                final_url: final_url.to_string(),
                updated_at: Instant::now(),
            },
        );
    }

    /// 查询 `original` 缓存到的最终地址；无缓存或已过期时返回 None。
    fn cache_lookup(&self, original: &str) -> Option<String> {
        let mut cache = self.redirect_cache.lock().ok()?;
        cache.retain(|_, entry| entry.updated_at.elapsed() < REDIRECT_CACHE_TTL);
        cache.get(original).map(|entry| entry.final_url.clone())
    }
}

/// 生成对前端公开的代理基础地址，前端在该地址后追加 `?url=` 即可发起代理请求。
pub fn proxy_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}{IPTV_PROXY_PATH}")
}

#[derive(Deserialize)]
pub struct ProxyQuery {
    pub url: String,
    /// 清单重写时附加的 Referer（清单最终地址），供分片/子清单上游请求携带。
    #[serde(rename = "ref", default)]
    pub ref_url: Option<String>,
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
    let referer = query.ref_url.as_deref();
    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());

    // 首次请求原始地址；失败时先整体重试一次（应对瞬时断流/截断），再考虑重定向缓存。
    let fetched = match fetch(&state.client, &upstream_url, range, referer).await {
        Ok(fetched) => fetched,
        Err((code, msg)) => match fetch(&state.client, &upstream_url, range, referer).await {
            Ok(fetched) => fetched,
            Err((_second_code, _second_msg)) => {
                if looks_like_manifest_url(&upstream_url) {
                    if let Some(response) =
                        serve_cached_manifest(state, &upstream_url, range, referer).await
                    {
                        return response;
                    }
                }
                return (code, msg).into_response();
            }
        },
    };

    // 判断是否为清单，并缓存 原始->最终 映射。只有内容以 #EXTM3U 开头才视为清单，
    // Content-Type 与 URL 扩展名仅作为“本应返回清单”的提示，用于失败后的缓存重试。
    let (is_manifest, is_bad_manifest) = match &fetched {
        Fetched::Full {
            status,
            headers,
            final_url,
            bytes,
            ..
        } => {
            let sniffed = is_playlist_sniff(bytes);
            let expected_manifest =
                looks_like_manifest_url(&upstream_url) || content_type_is_playlist(headers);
            if status.is_success() && sniffed {
                state.cache_update(upstream_url.as_str(), final_url);
            }
            let is_manifest = status.is_success() && sniffed;
            let is_bad = expected_manifest && (!status.is_success() || !sniffed);
            (is_manifest, is_bad)
        }
        Fetched::Stream(_) => (false, false),
    };

    if is_manifest {
        if let Fetched::Full {
            bytes, final_url, ..
        } = &fetched
        {
            let rewritten = rewrite_hls_manifest(bytes, final_url, &state.proxy_base);
            return manifest_response(rewritten);
        }
    }

    // 清单地址拿到了非成功状态或非清单内容（签名过期/反盗链），尝试用缓存最终地址重试。
    if is_bad_manifest {
        if let Some(response) = serve_cached_manifest(state, &upstream_url, range, referer).await {
            return response;
        }
    }

    serve_media(fetched)
}

/// 使用缓存中的最终地址重拉取清单；无可用缓存时返回 None。
async fn serve_cached_manifest(
    state: &HlsProxyState,
    original: &Url,
    range: Option<&str>,
    referer: Option<&str>,
) -> Option<Response> {
    let cached = state.cache_lookup(original.as_str())?;
    if cached == original.as_str() {
        return None;
    }
    let cached_url = Url::parse(&cached).ok()?;
    log::info!("iptv proxy manifest refetch via cached final url: {original} -> {cached}");
    match fetch(&state.client, &cached_url, range, referer)
        .await
        .ok()?
    {
        Fetched::Full {
            status,
            headers,
            final_url,
            bytes,
        } => {
            state.cache_update(original.as_str(), &final_url);
            if status.is_success() && is_playlist_sniff(&bytes) {
                Some(manifest_response(rewrite_hls_manifest(
                    &bytes,
                    &final_url,
                    &state.proxy_base,
                )))
            } else {
                Some(media_response(status, &headers, bytes))
            }
        }
        Fetched::Stream(response) => Some(serve_media_stream(response)),
    }
}

/// 上游响应：要么完整缓冲（可校验长度），要么超限流式透传。
enum Fetched {
    Full {
        status: StatusCode,
        headers: HeaderMap,
        final_url: Url,
        bytes: Vec<u8>,
    },
    Stream(UpstreamResponse),
}

/// 请求上游。分片/子资源会按声明长度完整缓冲后再返回，截断或超限视为失败。
async fn fetch(
    client: &reqwest::Client,
    url: &Url,
    range: Option<&str>,
    referer: Option<&str>,
) -> Result<Fetched, (StatusCode, String)> {
    let mut request = client
        .get(url.clone())
        .header(header::USER_AGENT, UPSTREAM_USER_AGENT);
    if let Some(range) = range {
        request = request.header(header::RANGE, range);
    }
    if let Some(referer) = referer {
        request = request.header(header::REFERER, referer);
    }

    let response = request.send().await.map_err(|err| {
        log::error!("iptv proxy upstream request failed for {url}: {err}");
        (
            StatusCode::BAD_GATEWAY,
            format!("upstream request failed: {err}"),
        )
    })?;

    let status = response.status();
    let headers = response.headers().clone();
    let final_url = response.url().clone();
    let declared = headers
        .get(header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<usize>().ok());

    // 声明长度超过缓冲上限时直接流式透传。
    if declared.is_some_and(|size| size > MAX_BUFFER_SIZE) {
        return Ok(Fetched::Stream(response));
    }

    let mut bytes = Vec::new();
    let mut stream = response;
    loop {
        match stream.chunk().await {
            Ok(Some(chunk)) => {
                if bytes.len() + chunk.len() > MAX_BUFFER_SIZE {
                    return Err((
                        StatusCode::BAD_GATEWAY,
                        format!("upstream response too large for {url}"),
                    ));
                }
                bytes.extend_from_slice(&chunk);
            }
            Ok(None) => break,
            Err(err) => {
                log::warn!("iptv proxy upstream response truncated for {url}: {err}");
                return Err((
                    StatusCode::BAD_GATEWAY,
                    format!("upstream response truncated: {err}"),
                ));
            }
        }
    }

    if let Some(size) = declared {
        if bytes.len() < size {
            log::warn!(
                "iptv proxy upstream response length mismatch for {url}: expected {size}, got {}",
                bytes.len()
            );
            return Err((
                StatusCode::BAD_GATEWAY,
                format!(
                    "upstream response truncated: expected {size} bytes, got {}",
                    bytes.len()
                ),
            ));
        }
    }

    Ok(Fetched::Full {
        status,
        headers,
        final_url,
        bytes,
    })
}

fn content_type_is_playlist(headers: &HeaderMap) -> bool {
    headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|content_type| {
            let lower = content_type.to_lowercase();
            lower.contains("mpegurl") || lower.contains("hls")
        })
        .unwrap_or(false)
}

fn looks_like_manifest_url(url: &Url) -> bool {
    let path = url.path().to_ascii_lowercase();
    path.ends_with(".m3u8") || path.ends_with(".m3u")
}

fn is_playlist_sniff(bytes: &[u8]) -> bool {
    let bytes = strip_bom(bytes);
    bytes.starts_with(b"#EXTM3U")
}

fn strip_bom(input: &[u8]) -> &[u8] {
    input.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(input)
}

fn manifest_response(rewritten: String) -> Response {
    (
        [
            (
                header::CONTENT_TYPE,
                "application/vnd.apple.mpegurl".to_string(),
            ),
            (header::CACHE_CONTROL, "no-cache".to_string()),
        ],
        rewritten,
    )
        .into_response()
}

fn serve_media(fetched: Fetched) -> Response {
    match fetched {
        Fetched::Full {
            status,
            headers,
            bytes,
            ..
        } => media_response(status, &headers, bytes),
        Fetched::Stream(response) => serve_media_stream(response),
    }
}

fn media_response(status: StatusCode, headers: &HeaderMap, bytes: Vec<u8>) -> Response {
    let mut response_headers = HeaderMap::new();
    for key in [
        header::CONTENT_TYPE,
        header::CONTENT_RANGE,
        header::ACCEPT_RANGES,
        header::CONTENT_ENCODING,
    ] {
        if let Some(value) = headers.get(&key) {
            response_headers.insert(key, value.clone());
        }
    }
    response_headers.insert(
        header::CONTENT_LENGTH,
        bytes.len().to_string().parse().unwrap(),
    );
    (status, response_headers, bytes).into_response()
}

fn serve_media_stream(response: UpstreamResponse) -> Response {
    let mut response_headers = HeaderMap::new();
    for key in [
        header::CONTENT_TYPE,
        header::CONTENT_RANGE,
        header::ACCEPT_RANGES,
        header::CONTENT_ENCODING,
    ] {
        if let Some(value) = response.headers().get(&key) {
            response_headers.insert(key, value.clone());
        }
    }
    (
        response.status(),
        response_headers,
        Body::from_stream(response.bytes_stream()),
    )
        .into_response()
}

/// 重写 m3u8 清单，把所有子资源 URI（分片、子清单、密钥）改写为经本代理访问的地址。
/// 优先使用 m3u8-rs 完整解析改写；解析/序列化失败时回退为逐行重写以保证兼容。
fn rewrite_hls_manifest(body: &[u8], manifest_url: &Url, proxy_base: &str) -> String {
    let playlist = match m3u8_rs::parse_playlist_res(strip_bom(body)) {
        Ok(playlist) => playlist,
        Err(_) => {
            log::debug!("m3u8 parse failed, fallback to line-based rewrite for {manifest_url}");
            return fallback_rewrite_hls_manifest(body, manifest_url, proxy_base);
        }
    };

    let playlist = match playlist {
        Playlist::MasterPlaylist(mut playlist) => {
            for variant in &mut playlist.variants {
                variant.uri =
                    proxy_uri_with_ref(&variant.uri, manifest_url, proxy_base, manifest_url);
            }
            for alternative in &mut playlist.alternatives {
                if let Some(uri) = &mut alternative.uri {
                    *uri = proxy_uri_with_ref(uri, manifest_url, proxy_base, manifest_url);
                }
            }
            for session_key in &mut playlist.session_key {
                if let Some(uri) = &mut session_key.0.uri {
                    *uri = proxy_uri_with_ref(uri, manifest_url, proxy_base, manifest_url);
                }
            }
            for session_data in &mut playlist.session_data {
                if let SessionDataField::Uri(uri) = &mut session_data.field {
                    *uri = proxy_uri_with_ref(uri, manifest_url, proxy_base, manifest_url);
                }
            }
            Playlist::MasterPlaylist(playlist)
        }
        Playlist::MediaPlaylist(mut playlist) => {
            for segment in &mut playlist.segments {
                segment.uri =
                    proxy_uri_with_ref(&segment.uri, manifest_url, proxy_base, manifest_url);
                if let Some(key) = &mut segment.key {
                    if let Some(uri) = &mut key.uri {
                        *uri = proxy_uri_with_ref(uri, manifest_url, proxy_base, manifest_url);
                    }
                }
                if let Some(map) = &mut segment.map {
                    map.uri = proxy_uri_with_ref(&map.uri, manifest_url, proxy_base, manifest_url);
                }
            }
            Playlist::MediaPlaylist(playlist)
        }
    };

    let mut output = Vec::new();
    match playlist.write_to(&mut output) {
        Ok(()) => String::from_utf8_lossy(&output).into_owned(),
        Err(_) => fallback_rewrite_hls_manifest(body, manifest_url, proxy_base),
    }
}

/// 回退用的逐行重写：重写所有子资源 URI，其余行原样保留。
fn fallback_rewrite_hls_manifest(body: &[u8], manifest_url: &Url, proxy_base: &str) -> String {
    let text = String::from_utf8_lossy(strip_bom(body));
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
            out.push_str(&proxy_uri_with_ref(
                line,
                manifest_url,
                proxy_base,
                manifest_url,
            ));
            out.push('\n');
        }
    }
    out
}

/// 重写单行 URI 为代理地址并附加 Referer 参数；解析失败时保留原文。
fn proxy_uri_with_ref(raw: &str, base: &Url, proxy_base: &str, referer: &Url) -> String {
    let rewritten = proxy_uri(raw, base, proxy_base);
    if rewritten == raw {
        raw.to_string()
    } else {
        format!("{rewritten}&ref={}", urlencoding::encode(referer.as_str()))
    }
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
                    out.push_str(&proxy_uri_with_ref(value, base, proxy_base, base));
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
    use std::sync::atomic::{AtomicUsize, Ordering};
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

    fn proxy_query(url: String) -> ProxyQuery {
        ProxyQuery { url, ref_url: None }
    }

    const REFERER: &str = "http://example.com/live/playlist.m3u8";

    #[test]
    #[allow(non_snake_case)]
    fn 测试_生成代理基础地址() {
        assert_eq!(proxy_base_url(12345), "http://127.0.0.1:12345/iptv-proxy");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写清单_m3u8库解析_相对分片密钥与映射() {
        let base = Url::parse("http://example.com/live/playlist.m3u8").unwrap();
        let body = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:100\n#EXTINF:10.0,\nseg.ts\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\n#EXTINF:10.0,\nseg2.ts\n#EXT-X-ENDLIST\n";
        let rewritten = rewrite_hls_manifest(body.as_bytes(), &base, PROXY_BASE);
        let seg_ref = format!(
            "http://127.0.0.1:9999/iptv-proxy?url={}&ref={}",
            urlencoding::encode("http://example.com/live/seg.ts"),
            urlencoding::encode(REFERER)
        );
        let key_ref = format!(
            "URI=\"http://127.0.0.1:9999/iptv-proxy?url={}&ref={}\"",
            urlencoding::encode("http://example.com/live/key.bin"),
            urlencoding::encode(REFERER)
        );
        assert!(rewritten.contains(&seg_ref), "实际输出: {rewritten}");
        assert!(rewritten.contains(&key_ref), "实际输出: {rewritten}");
        assert!(rewritten.contains("#EXT-X-MEDIA-SEQUENCE:100"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写清单_m3u8库解析_master清单() {
        let base = Url::parse("http://example.com/master.m3u8").unwrap();
        let body = "#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"a1\",NAME=\"aud\",URI=\"audio.m3u8\"\n#EXT-X-STREAM-INF:BANDWIDTH=1280000\nhttp://cdn.example.com/video/index.m3u8\n";
        let rewritten = rewrite_hls_manifest(body.as_bytes(), &base, PROXY_BASE);
        assert!(rewritten.contains(&format!(
            "http://127.0.0.1:9999/iptv-proxy?url={}",
            urlencoding::encode("http://example.com/audio.m3u8")
        )));
        assert!(rewritten.contains(&format!(
            "http://127.0.0.1:9999/iptv-proxy?url={}",
            urlencoding::encode("http://cdn.example.com/video/index.m3u8")
        )));
        assert!(rewritten.contains("#EXT-X-STREAM-INF:BANDWIDTH=1280000"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写清单_带BOM() {
        let base = Url::parse("http://example.com/live/playlist.m3u8").unwrap();
        let mut body = vec![0xEF, 0xBB, 0xBF];
        body.extend_from_slice(b"#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10.0,\nseg.ts\n");
        let rewritten = rewrite_hls_manifest(&body, &base, PROXY_BASE);
        assert!(rewritten.contains("http://127.0.0.1:9999/iptv-proxy?url="));
        assert!(!rewritten.starts_with('\u{FEFF}'));
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

    #[test]
    #[allow(non_snake_case)]
    fn 测试_清单识别_内容嗅探与扩展名() {
        let base = Url::parse("http://example.com/live.m3u8").unwrap();
        assert!(looks_like_manifest_url(&base));
        assert!(!looks_like_manifest_url(
            &Url::parse("http://example.com/seg.ts").unwrap()
        ));
        assert!(is_playlist_sniff(b"#EXTM3U\n#EXTINF:10.0,\nseg.ts\n"));
        assert!(is_playlist_sniff(b"\xEF\xBB\xBF#EXTM3U\n"));
        assert!(!is_playlist_sniff(b"<html>not a playlist</html>"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_重写清单_解析失败回退逐行重写() {
        let base = Url::parse("http://example.com/weird.m3u8").unwrap();
        let body = "#EXTINF:10.0,\nseg.ts\n#EXT-X-CUSTOM:HELLO=1\n";
        let rewritten = rewrite_hls_manifest(body.as_bytes(), &base, PROXY_BASE);
        assert!(
            rewritten.contains("http://127.0.0.1:9999/iptv-proxy?url="),
            "实际输出: {rewritten}"
        );
        assert!(
            rewritten.contains("#EXT-X-CUSTOM:HELLO=1"),
            "实际输出: {rewritten}"
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
        let query = proxy_query(format!("http://{addr}/live.m3u8"));
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        let expected = format!(
            "?url={}",
            urlencoding::encode(&format!("http://{addr}/seg.ts"))
        );
        assert!(text.contains(&expected));
        assert!(text.contains("ref="));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_octetstream清单按内容嗅探重写() {
        let addr = spawn_upstream(Router::new().route(
            "/stream",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "application/octet-stream")],
                    "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10.0,\nseg.ts\n",
                )
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/stream"));
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        let expected = format!(
            "?url={}",
            urlencoding::encode(&format!("http://{addr}/seg.ts"))
        );
        assert!(text.contains(&expected), "实际输出: {text}");
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
        let query = proxy_query(format!("http://{addr}/entry.m3u8"));
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
        let query = proxy_query(format!("http://{addr}/seg.ts"));
        let response = proxy_request(&test_state(), &query, &HeaderMap::new()).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_LENGTH)
                .and_then(|v| v.to_str().ok()),
            Some("5")
        );
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
        let query = proxy_query(format!("http://{addr}/echo"));
        let mut headers = HeaderMap::new();
        headers.insert(header::RANGE, "bytes=0-99".parse().unwrap());
        let (status, text) = body_of(proxy_request(&test_state(), &query, &headers).await).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "bytes=0-99");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_分片携带清单地址作为Referer() {
        let addr = spawn_upstream(Router::new().route(
            "/seg.ts",
            get(|headers: HeaderMap| async move {
                let referer = headers
                    .get(header::REFERER)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                ([(header::CONTENT_TYPE, "video/mp2t")], referer)
            }),
        ))
        .await;
        let query = ProxyQuery {
            url: format!("http://{addr}/seg.ts"),
            ref_url: Some("http://example.com/live/playlist.m3u8".to_string()),
        };
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(text, "http://example.com/live/playlist.m3u8");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_cookie存储_同域请求携带cookie() {
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/live.m3u8",
                    get(|| async {
                        (
                            [
                                (header::CONTENT_TYPE, "application/vnd.apple.mpegurl"),
                                (header::SET_COOKIE, "session=abc123; Path=/"),
                            ],
                            "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10.0,\nseg.ts\n",
                        )
                    }),
                )
                .route(
                    "/seg.ts",
                    get(|headers: HeaderMap| async move {
                        let cookie = headers
                            .get(header::COOKIE)
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or("none")
                            .to_string();
                        ([(header::CONTENT_TYPE, "video/mp2t")], cookie)
                    }),
                ),
        )
        .await;
        let state = test_state();
        let query = proxy_query(format!("http://{addr}/live.m3u8"));
        let (status, _) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        let seg_url = format!("http://{addr}/seg.ts");
        let query = proxy_query(seg_url);
        let (status, text) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(text.contains("session=abc123"), "实际 Cookie: {text}");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_重定向缓存_原地址失效后走缓存最终地址() {
        let entry_fails = Arc::new(AtomicUsize::new(0));
        let entry_fails_clone = entry_fails.clone();
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/entry.m3u8",
                    get(move || {
                        let entry_fails = entry_fails_clone.clone();
                        async move {
                            if entry_fails.load(Ordering::SeqCst) > 0 {
                                (
                                    StatusCode::SERVICE_UNAVAILABLE,
                                    [("location", "/final.m3u8")],
                                )
                            } else {
                                (StatusCode::FOUND, [("location", "/final.m3u8")])
                            }
                        }
                    }),
                )
                .route(
                    "/final.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\nfinal.ts\n",
                        )
                    }),
                ),
        )
        .await;
        let state = test_state();
        let query = proxy_query(format!("http://{addr}/entry.m3u8"));
        let (status, _) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);

        entry_fails.fetch_add(1, Ordering::SeqCst);
        let (status, text) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(text.contains(&format!(
            "?url={}",
            urlencoding::encode(&format!("http://{addr}/final.ts"))
        )));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_分片截断_重试后成功() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let attempts_clone = attempts.clone();
        let addr = spawn_upstream(Router::new().route(
            "/seg.ts",
            get(move || {
                let attempts = attempts_clone.clone();
                async move {
                    let count = attempts.fetch_add(1, Ordering::SeqCst);
                    let mut headers = HeaderMap::new();
                    headers.insert(header::CONTENT_TYPE, "video/mp2t".parse().unwrap());
                    if count == 0 {
                        headers.insert(header::CONTENT_LENGTH, "100".parse().unwrap());
                    }
                    (StatusCode::OK, headers, vec![0u8; 10])
                }
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/seg.ts"));
        let (status, _) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(attempts.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_分片截断_重试仍失败返回502() {
        let addr = spawn_upstream(Router::new().route(
            "/seg.ts",
            get(|| async {
                let mut headers = HeaderMap::new();
                headers.insert(header::CONTENT_LENGTH, "100".parse().unwrap());
                (StatusCode::OK, headers, vec![0u8; 10])
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/seg.ts"));
        let (status, _) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_上游错误状态透传() {
        let addr = spawn_upstream(Router::new().route(
            "/broken",
            get(|| async { StatusCode::INTERNAL_SERVER_ERROR }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/broken"));
        let response = proxy_request(&test_state(), &query, &HeaderMap::new()).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_非法URL_返回400() {
        let query = proxy_query("not-a-url".to_string());
        let (status, _) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_非http协议_返回400() {
        let query = proxy_query("ftp://example.com/live.m3u8".to_string());
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
        let query = proxy_query(format!("http://{addr}/ua"));
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

        let query = proxy_query(format!("http://{addr}/live.m3u8"));
        let (status, body) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert!(body.contains("upstream request failed"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_gzip压缩内容解压后长度正确() {
        use std::io::Write;
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&[0u8; 64]).unwrap();
        let compressed = encoder.finish().unwrap();

        let compressed_len = compressed.len().to_string();
        let addr = spawn_upstream(Router::new().route(
            "/seg.ts",
            get(move || {
                let compressed = compressed.clone();
                let content_length = compressed_len.clone();
                async move {
                    let mut headers = HeaderMap::new();
                    headers.insert(header::CONTENT_TYPE, "video/mp2t".parse().unwrap());
                    headers.insert(header::CONTENT_ENCODING, "gzip".parse().unwrap());
                    headers.insert(header::CONTENT_LENGTH, content_length.parse().unwrap());
                    (StatusCode::OK, headers, compressed)
                }
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/seg.ts"));
        let response = proxy_request(&test_state(), &query, &HeaderMap::new()).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.headers().get(header::CONTENT_ENCODING).is_none());
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_LENGTH)
                .and_then(|v| v.to_str().ok()),
            Some("64")
        );
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert_eq!(bytes.len(), 64);
    }
}
