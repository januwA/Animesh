use axum::{
    body::Body,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use bytes::Bytes;
use futures_util::{stream, StreamExt};
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

/// 播放器 User-Agent。部分直播源按 UA 分流：浏览器 UA 会被引导到蜜罐死链，
/// 只有播放器 UA（如 ffmpeg）才能拿到真实直播流。首次拉流失败时回退到该 UA 重试。
const PLAYER_USER_AGENT: &str = "Lavf62.12.100";

/// 嗅探前缀的最小长度，足以识别清单/FLV/TS/HTML 魔数。
const PEEK_MIN: usize = 16;

/// 分片/子资源的最大缓冲上限。超限时退化为流式透传。
const MAX_BUFFER_SIZE: usize = 64 * 1024 * 1024;

/// 重定向缓存有效期：覆盖 CDN 签名地址的常见过期周期（分钟级）。
const REDIRECT_CACHE_TTL: Duration = Duration::from_secs(600);

/// 清单被重定向到广告中继时的重试次数。部分盗播源会概率性把清单
/// 重定向到广告中继，重试直到命中真实中继为止。真实中继命中率约
/// 10%，故取较大值以保证大概率在首次发现时就拿到真实地址。
const MANIFEST_AD_RETRIES: usize = 10;

/// 广告中继判定标记（匹配 path+query 的小写形式）。`a=tvzb0011` 是
/// 广告家族的稳定查询参数；`mkt`/`zmt`/`adhw` 为历史路径标记，
/// 保留作为补充信号，兼容无查询参数的广告路径形态。
const AD_MANIFEST_MARKERS: &[&str] = &["a=tvzb0011", "mkt", "zmt", "adhw"];

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

    /// 删除 `original` 的缓存条目（缓存地址失效/确认是广告时使用）。
    fn cache_remove(&self, original: &str) {
        if let Ok(mut cache) = self.redirect_cache.lock() {
            cache.remove(original);
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
    /// 清单重写时附加的 Referer（清单最终地址），供分片/子清单上游请求携带。
    #[serde(rename = "ref", default)]
    pub ref_url: Option<String>,
}

/// 代理上游请求：m3u8 清单会被重写为经本代理访问，无限直播流（FLV/TS）流式透传，
/// 其余内容（ts 分片、密钥等）缓冲透传。
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
    log::info!(
        "[TRACE] iptv proxy_request url={} ref={referer:?} range={range:?}",
        query.url
    );

    // 直播清单刷新优先走已缓存的真实中继地址：一旦命中过真实中继就
    // 粘住它，避免每次刷新都重新赌概率重定向到广告中继。无缓存或
    // 缓存失效时才重新请求原始地址。
    if looks_like_manifest_url(&upstream_url) {
        if let Some(response) = serve_cached_manifest(state, &upstream_url, range, referer).await {
            return response;
        }
    }

    // 首次请求原始地址；失败时先整体重试一次（应对瞬时断流/截断），再考虑重定向缓存。
    match fetch_browser(state, &upstream_url, range, referer).await {
        Ok(response) => response,
        Err((code, msg)) => match fetch_browser(state, &upstream_url, range, referer).await {
            Ok(response) => response,
            Err((_second_code, _second_msg)) => {
                if looks_like_manifest_url(&upstream_url) {
                    if let Some(response) =
                        serve_cached_manifest(state, &upstream_url, range, referer).await
                    {
                        return response;
                    }
                }
                (code, msg).into_response()
            }
        },
    }
}

/// 以浏览器 UA 拉取上游并分类处理；仅网络级失败返回 Err。
async fn fetch_browser(
    state: &HlsProxyState,
    url: &Url,
    range: Option<&str>,
    referer: Option<&str>,
) -> Result<Response, (StatusCode, String)> {
    log::info!(
        "[TRACE] proxy fetch_browser url={url} referer={referer:?} range={range:?} ua={UPSTREAM_USER_AGENT}"
    );
    let fetched = fetch(&state.client, url, range, referer, UPSTREAM_USER_AGENT).await?;
    Ok(handle_fetched(state, fetched, url, range, referer).await)
}

/// 分类并处理一次上游响应：清单重写、蜜罐 HTML 回退播放器 UA、缓存重试、媒体透传。
async fn handle_fetched(
    state: &HlsProxyState,
    fetched: Fetched,
    original: &Url,
    range: Option<&str>,
    referer: Option<&str>,
) -> Response {
    match fetched {
        Fetched::Full {
            status,
            headers,
            final_url,
            bytes,
        } => {
            let sniffed = sniff(&bytes);
            let expected_manifest =
                looks_like_manifest_url(original) || content_type_is_playlist(&headers);

            if status.is_success() && sniffed == Sniff::Playlist {
                log::info!(
                    "[TRACE] proxy playlist hit: original={original} redirected_to={final_url} status={status} bytes={}",
                    bytes.len()
                );
                // 广告中继：清单被重定向到广告路径时重试命中真实中继，广告地址不写入缓存。
                if expected_manifest && looks_like_ad_manifest(&final_url) {
                    log::info!(
                        "[TRACE] proxy ad relay detected: {final_url}, retry for real relay"
                    );
                    if let Some(response) =
                        retry_real_manifest(state, original, range, referer).await
                    {
                        return response;
                    }
                    if let Some(response) =
                        serve_cached_manifest(state, original, range, referer).await
                    {
                        return response;
                    }
                    log::info!(
                        "[TRACE] proxy ad relay all retries failed, serve ad manifest as fallback"
                    );
                    return manifest_response(rewrite_hls_manifest(
                        &bytes,
                        &final_url,
                        &state.proxy_base,
                    ));
                }
                state.cache_update(original.as_str(), &final_url);
                return manifest_response(rewrite_hls_manifest(
                    &bytes,
                    &final_url,
                    &state.proxy_base,
                ));
            }

            // 蜜罐：浏览器 UA 拿到的多为 200 HTML（反盗链），换播放器 UA 重试原始地址。
            if status.is_success() && sniffed == Sniff::Html {
                log::info!(
                    "[TRACE] proxy html honeypot: original={original} status={status}, retry with player UA"
                );
                if let Some(response) = retry_player_fetch(state, original, range, referer).await {
                    return response;
                }
                return media_response(status, &headers, bytes);
            }

            // 清单地址拿到了非成功状态或非清单内容（签名过期/反盗链），尝试用缓存最终地址重试。
            if expected_manifest && (!status.is_success() || sniffed != Sniff::Playlist) {
                log::info!(
                    "[TRACE] proxy manifest not ok: original={original} status={status} sniff={sniffed:?}, try cached final url"
                );
                if let Some(response) = serve_cached_manifest(state, original, range, referer).await
                {
                    return response;
                }
            }

            log::info!(
                "[TRACE] proxy media passthrough: original={original} final={final_url} status={status} sniff={sniffed:?} bytes={}",
                bytes.len()
            );
            media_response(status, &headers, bytes)
        }
        Fetched::Stream {
            status,
            headers,
            body,
        } => {
            log::info!(
                "[TRACE] proxy media stream passthrough: original={original} status={status}"
            );
            serve_media_stream(status, &headers, body)
        }
    }
}

/// 用播放器 UA 重试一次并处理结果（不再递归，避免死循环）。
async fn retry_player_fetch(
    state: &HlsProxyState,
    original: &Url,
    range: Option<&str>,
    referer: Option<&str>,
) -> Option<Response> {
    log::info!("[TRACE] proxy retry with player UA: {original}");
    let fetched = fetch(&state.client, original, range, referer, PLAYER_USER_AGENT)
        .await
        .ok()?;

    match fetched {
        Fetched::Full {
            status,
            headers,
            final_url,
            bytes,
        } => {
            let sniffed = sniff(&bytes);
            if status.is_success() && sniffed == Sniff::Playlist {
                if looks_like_ad_manifest(&final_url) {
                    log::info!(
                        "[TRACE] proxy player UA ad playlist: original={original} redirected_to={final_url}, give up"
                    );
                    return None;
                }
                log::info!(
                    "[TRACE] proxy player UA playlist: original={original} redirected_to={final_url} status={status}"
                );
                state.cache_update(original.as_str(), &final_url);
                Some(manifest_response(rewrite_hls_manifest(
                    &bytes,
                    &final_url,
                    &state.proxy_base,
                )))
            } else if status.is_success() && sniffed == Sniff::Html {
                log::info!(
                    "[TRACE] proxy player UA also html: original={original} status={status}, give up"
                );
                None
            } else {
                log::info!(
                    "[TRACE] proxy player UA media: original={original} final={final_url} status={status} sniff={sniffed:?}"
                );
                Some(media_response(status, &headers, bytes))
            }
        }
        Fetched::Stream {
            status,
            headers,
            body,
        } => {
            log::info!("[TRACE] proxy player UA stream: original={original} status={status}");
            Some(serve_media_stream(status, &headers, body))
        }
    }
}

/// 清单被重定向到广告中继时，重试原始地址若干次直到命中真实中继。
/// 全部失败时返回 None，由调用方决定兜底（缓存最终地址或透传广告清单）。
async fn retry_real_manifest(
    state: &HlsProxyState,
    original: &Url,
    range: Option<&str>,
    referer: Option<&str>,
) -> Option<Response> {
    for attempt in 1..=MANIFEST_AD_RETRIES {
        tokio::time::sleep(Duration::from_millis(200)).await;
        let Ok(fetched) = fetch(&state.client, original, range, referer, UPSTREAM_USER_AGENT).await
        else {
            log::info!("[TRACE] proxy ad retry attempt {attempt} fetch failed for {original}");
            continue;
        };
        match fetched {
            Fetched::Full {
                status,
                headers: _,
                final_url,
                bytes,
            } => {
                let sniffed = sniff(&bytes);
                if status.is_success()
                    && sniffed == Sniff::Playlist
                    && !looks_like_ad_manifest(&final_url)
                {
                    log::info!(
                        "[TRACE] proxy ad retry success on attempt {attempt}: {original} -> {final_url}"
                    );
                    state.cache_update(original.as_str(), &final_url);
                    return Some(manifest_response(rewrite_hls_manifest(
                        &bytes,
                        &final_url,
                        &state.proxy_base,
                    )));
                }
                log::info!(
                    "[TRACE] proxy ad retry attempt {attempt} not real: final={final_url} status={status} sniff={sniffed:?}"
                );
            }
            Fetched::Stream {
                status,
                headers,
                body,
            } => {
                log::info!(
                    "[TRACE] proxy ad retry attempt {attempt} stream: original={original} status={status}"
                );
                return Some(serve_media_stream(status, &headers, body));
            }
        }
    }
    None
}

/// 依据 URL 判定是否为广告中继清单。优先匹配查询参数 `a=tvzb0011`
/// （广告家族的稳定标记，`byt`/`yss`/`mkt` 均携带），再匹配
/// `mkt`/`zmt`/`adhw` 等历史路径标记。真实中继（`from=zbdq6`）不含
/// 上述标记，不会被误判。
fn looks_like_ad_manifest(url: &Url) -> bool {
    let mut hay = url.path().to_ascii_lowercase();
    if let Some(query) = url.query() {
        hay.push('?');
        hay.push_str(&query.to_ascii_lowercase());
    }
    AD_MANIFEST_MARKERS
        .iter()
        .any(|marker| hay.contains(marker))
}

/// 流类型判定结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StreamKind {
    Hls,
    Flv,
    Unknown,
}

/// Tauri 命令返回的已解析直播源。
#[derive(serde::Serialize)]
pub struct ResolvedStream {
    pub proxy_url: String,
    pub kind: StreamKind,
}

/// 嗅探上游响应并判定流类型（只读取少量前缀即断开，不消耗直播流）。
pub async fn probe_stream(state: &HlsProxyState, raw_url: &str) -> StreamKind {
    log::info!("[TRACE] probe_stream start raw_url={raw_url}");
    let Ok(url) = Url::parse(raw_url) else {
        log::info!("[TRACE] probe_stream parse failed, return Unknown");
        return StreamKind::Unknown;
    };
    if !matches!(url.scheme(), "http" | "https") {
        log::info!(
            "[TRACE] probe_stream unsupported scheme={}, return Unknown",
            url.scheme()
        );
        return StreamKind::Unknown;
    }

    let first = probe_sniff(&state.client, &url, UPSTREAM_USER_AGENT).await;
    log::info!("[TRACE] probe_stream browser UA sniff={first:?} url={raw_url}");
    let kind = classify_sniff(first);
    if kind != StreamKind::Unknown {
        log::info!("[TRACE] probe_stream classified={kind:?} via browser UA, url={raw_url}");
        return kind;
    }
    let second = probe_sniff(&state.client, &url, PLAYER_USER_AGENT).await;
    log::info!("[TRACE] probe_stream player UA sniff={second:?} url={raw_url}");
    let kind = classify_sniff(second);
    log::info!("[TRACE] probe_stream classified={kind:?} via player UA fallback, url={raw_url}");
    kind
}

fn classify_sniff(sniffed: Sniff) -> StreamKind {
    match sniffed {
        Sniff::Playlist => StreamKind::Hls,
        Sniff::Flv | Sniff::MpegTs => StreamKind::Flv,
        Sniff::Html | Sniff::Unknown => StreamKind::Unknown,
    }
}

/// 使用缓存中的最终地址重拉取清单；无可用缓存或缓存地址失效时返回 None。
/// 缓存里的广告中继地址会被拒绝，失效（签名过期/反盗链）的条目会被清除，
/// 以便调用方重新请求原始地址以发现新的真实中继。
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
    if looks_like_ad_manifest(&cached_url) {
        log::info!("[TRACE] proxy cached ad relay skipped: {original} -> {cached}, remove entry");
        state.cache_remove(original.as_str());
        return None;
    }
    log::info!("[TRACE] proxy manifest refetch via cached final url: {original} -> {cached}");
    let Ok(fetched) = fetch(
        &state.client,
        &cached_url,
        range,
        referer,
        UPSTREAM_USER_AGENT,
    )
    .await
    else {
        return None;
    };
    match fetched {
        Fetched::Full {
            status,
            headers: _,
            final_url,
            bytes,
        } => {
            if status.is_success() && is_playlist_sniff(&bytes) {
                state.cache_update(original.as_str(), &final_url);
                return Some(manifest_response(rewrite_hls_manifest(
                    &bytes,
                    &final_url,
                    &state.proxy_base,
                )));
            }
            log::info!(
                "[TRACE] proxy cached manifest invalid: {original} -> {cached} status={status}, remove entry"
            );
            state.cache_remove(original.as_str());
            None
        }
        Fetched::Stream {
            status,
            headers,
            body,
        } => Some(serve_media_stream(status, &headers, body)),
    }
}

/// 上游响应：要么完整缓冲（可校验长度），要么流式透传。
enum Fetched {
    Full {
        status: StatusCode,
        headers: HeaderMap,
        final_url: Url,
        bytes: Vec<u8>,
    },
    Stream {
        status: StatusCode,
        headers: HeaderMap,
        body: Body,
    },
}

/// 前缀内容嗅探分类。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Sniff {
    Playlist,
    Flv,
    MpegTs,
    Html,
    Unknown,
}

/// 请求上游。有声明长度的小体积分片/清单会完整缓冲并按长度校验；
/// 无长度且嗅探为直播流（FLV/TS）的内容改为流式透传，避免无限流被 64MB 上限截断。
async fn fetch(
    client: &reqwest::Client,
    url: &Url,
    range: Option<&str>,
    referer: Option<&str>,
    user_agent: &str,
) -> Result<Fetched, (StatusCode, String)> {
    let response = send(client, url, range, referer, user_agent)
        .await
        .map_err(|err| {
            log::error!("iptv proxy upstream request failed for {url}: {err}");
            (
                StatusCode::BAD_GATEWAY,
                format!("upstream request failed: {err}"),
            )
        })?;

    let status = response.status();
    let headers = response.headers().clone();
    let final_url = response.url().clone();
    if looks_like_manifest_url(url) {
        log::info!("[TRACE] proxy upstream manifest: url={url} status={status} final={final_url}");
    } else {
        log::debug!("[TRACE] proxy upstream media: url={url} status={status} final={final_url}");
    }
    let declared = headers
        .get(header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<usize>().ok());

    // 声明长度超过缓冲上限时直接流式透传。
    if declared.is_some_and(|size| size > MAX_BUFFER_SIZE) {
        return Ok(Fetched::Stream {
            status,
            headers,
            body: Body::from_stream(response.bytes_stream()),
        });
    }

    let mut stream = response.bytes_stream();

    // 读取前缀用于嗅探。
    let mut prefix = Vec::new();
    loop {
        if prefix.len() >= PEEK_MIN {
            break;
        }
        match stream.next().await {
            Some(Ok(chunk)) => prefix.extend_from_slice(&chunk),
            Some(Err(err)) => {
                log::warn!("iptv proxy upstream response truncated for {url}: {err}");
                return Err((
                    StatusCode::BAD_GATEWAY,
                    format!("upstream response truncated: {err}"),
                ));
            }
            None => break,
        }
    }

    // 无声明长度的直播流（FLV/TS）流式透传，前缀与剩余流拼接。
    if declared.is_none() && matches!(sniff(&prefix), Sniff::Flv | Sniff::MpegTs) {
        let body = Body::from_stream(
            stream::iter([Ok::<Bytes, reqwest::Error>(Bytes::from(prefix))]).chain(stream),
        );
        return Ok(Fetched::Stream {
            status,
            headers,
            body,
        });
    }

    let mut bytes = prefix;
    loop {
        match stream.next().await {
            Some(Ok(chunk)) => {
                if bytes.len() + chunk.len() > MAX_BUFFER_SIZE {
                    return Err((
                        StatusCode::BAD_GATEWAY,
                        format!("upstream response too large for {url}"),
                    ));
                }
                bytes.extend_from_slice(&chunk);
            }
            Some(Err(err)) => {
                log::warn!("iptv proxy upstream response truncated for {url}: {err}");
                return Err((
                    StatusCode::BAD_GATEWAY,
                    format!("upstream response truncated: {err}"),
                ));
            }
            None => break,
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

/// 发送上游请求并携带指定 User-Agent、Range、Referer。
async fn send(
    client: &reqwest::Client,
    url: &Url,
    range: Option<&str>,
    referer: Option<&str>,
    user_agent: &str,
) -> Result<UpstreamResponse, reqwest::Error> {
    let mut request = client
        .get(url.clone())
        .header(header::USER_AGENT, user_agent);
    if let Some(range) = range {
        request = request.header(header::RANGE, range);
    }
    if let Some(referer) = referer {
        request = request.header(header::REFERER, referer);
    }
    request.send().await
}

/// 只读取少量前缀用于探测流类型，随后断开连接，不消费直播流。
async fn probe_sniff(client: &reqwest::Client, url: &Url, user_agent: &str) -> Sniff {
    let Ok(response) = send(client, url, None, None, user_agent).await else {
        log::info!("[TRACE] probe_sniff request failed for {url} ua={user_agent}");
        return Sniff::Unknown;
    };
    if !response.status().is_success() {
        log::info!(
            "[TRACE] probe_sniff status={} for {url} ua={user_agent}",
            response.status()
        );
        return Sniff::Unknown;
    }
    let final_url = response.url().clone();
    let mut stream = response.bytes_stream();
    let mut prefix = Vec::new();
    loop {
        if prefix.len() >= PEEK_MIN {
            break;
        }
        match stream.next().await {
            Some(Ok(chunk)) => prefix.extend_from_slice(&chunk),
            Some(Err(_)) | None => break,
        }
    }
    let sniffed = sniff(&prefix);
    log::info!("[TRACE] probe_sniff final_url={final_url} sniff={sniffed:?} ua={user_agent}");
    sniffed
}

/// 依据前缀魔数分类内容。
fn sniff(bytes: &[u8]) -> Sniff {
    let b = strip_bom(bytes);
    if b.starts_with(b"#EXTM3U") {
        return Sniff::Playlist;
    }
    if b.starts_with(b"FLV") && b.get(3) == Some(&0x01) {
        return Sniff::Flv;
    }
    if b.first() == Some(&0x47) {
        return Sniff::MpegTs;
    }
    if trim_start_ascii_whitespace(b).starts_with(b"<") {
        return Sniff::Html;
    }
    Sniff::Unknown
}

fn trim_start_ascii_whitespace(mut input: &[u8]) -> &[u8] {
    while let [first, rest @ ..] = input {
        if !first.is_ascii_whitespace() {
            break;
        }
        input = rest;
    }
    input
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

fn serve_media_stream(status: StatusCode, headers: &HeaderMap, body: Body) -> Response {
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
    (status, response_headers, body).into_response()
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
    use axum::{body::to_bytes, response::IntoResponse, routing::get, Router};
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

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_蜜罐HTML_浏览器UA回退播放器UA_流式透传FLV() {
        let addr = spawn_upstream(Router::new().route(
            "/entry",
            get(|headers: HeaderMap| async move {
                let ua = headers
                    .get(header::USER_AGENT)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();
                if ua.starts_with("Mozilla") {
                    (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html")],
                        b"<html><body>honeypot</body></html>".to_vec(),
                    )
                        .into_response()
                } else {
                    let flv = vec![
                        0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00,
                        0x00,
                    ];
                    (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "video/x-flv")],
                        Body::from_stream(stream::iter([Ok::<Bytes, std::io::Error>(
                            Bytes::from(flv),
                        )])),
                    )
                        .into_response()
                }
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/entry"));
        let response = proxy_request(&test_state(), &query, &HeaderMap::new()).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok()),
            Some("video/x-flv")
        );
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert!(
            bytes.starts_with(&[0x46, 0x4c, 0x56, 0x01]),
            "实际字节: {bytes:?}"
        );
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_蜜罐HTML_浏览器UA回退播放器UA_重写清单() {
        let addr = spawn_upstream(Router::new().route(
            "/entry",
            get(|headers: HeaderMap| async move {
                let ua = headers
                    .get(header::USER_AGENT)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();
                if ua.starts_with("Mozilla") {
                    (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html")],
                        b"<html><body>honeypot</body></html>".to_vec(),
                    )
                        .into_response()
                } else {
                    (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                        "#EXTM3U\n#EXTINF:10.0,\nseg.ts\n",
                    )
                        .into_response()
                }
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/entry"));
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(
            text.contains("?url=") && text.contains("seg.ts"),
            "实际输出: {text}"
        );
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_播放器UA也返回HTML_透传原响应不回退死循环() {
        let addr = spawn_upstream(Router::new().route(
            "/entry",
            get(|| async {
                (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, "text/html")],
                    b"<html><body>honeypot</body></html>".to_vec(),
                )
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/entry"));
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(text.starts_with("<html>"), "实际输出: {text}");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_无限FLV流式透传_保留内容类型() {
        let addr = spawn_upstream(Router::new().route(
            "/live",
            get(|| async {
                let flv = vec![
                    0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00,
                ];
                (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, "video/x-flv")],
                    Body::from_stream(stream::iter([
                        Ok::<Bytes, std::io::Error>(Bytes::from(flv)),
                        Ok::<Bytes, std::io::Error>(Bytes::from_static(b"tail-data")),
                    ])),
                )
            }),
        ))
        .await;
        let query = proxy_query(format!("http://{addr}/live"));
        let response = proxy_request(&test_state(), &query, &HeaderMap::new()).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok()),
            Some("video/x-flv")
        );
        assert!(response.headers().get(header::CONTENT_LENGTH).is_none());
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert!(
            bytes.starts_with(&[0x46, 0x4c, 0x56, 0x01]) && bytes.ends_with(b"tail-data"),
            "实际字节: {bytes:?}"
        );
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_probe_stream_识别HLS() {
        let addr = spawn_upstream(Router::new().route(
            "/live.m3u8",
            get(|| async {
                (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                    "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10.0,\nseg.ts\n",
                )
            }),
        ))
        .await;
        let kind = probe_stream(&test_state(), &format!("http://{addr}/live.m3u8")).await;
        assert_eq!(kind, StreamKind::Hls);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_probe_stream_识别FLV() {
        let addr = spawn_upstream(Router::new().route(
            "/live",
            get(|| async {
                let flv = vec![
                    0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00,
                ];
                (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, "video/x-flv")],
                    Body::from_stream(stream::iter([Ok::<Bytes, std::io::Error>(Bytes::from(
                        flv,
                    ))])),
                )
            }),
        ))
        .await;
        let kind = probe_stream(&test_state(), &format!("http://{addr}/live")).await;
        assert_eq!(kind, StreamKind::Flv);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_probe_stream_蜜罐后回退播放器UA识别FLV() {
        let addr = spawn_upstream(Router::new().route(
            "/entry",
            get(|headers: HeaderMap| async move {
                let ua = headers
                    .get(header::USER_AGENT)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();
                if ua.starts_with("Mozilla") {
                    (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "text/html")],
                        b"<html><body>honeypot</body></html>".to_vec(),
                    )
                        .into_response()
                } else {
                    let flv = vec![
                        0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00,
                        0x00,
                    ];
                    (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "video/x-flv")],
                        Body::from_stream(stream::iter([Ok::<Bytes, std::io::Error>(
                            Bytes::from(flv),
                        )])),
                    )
                        .into_response()
                }
            }),
        ))
        .await;
        let kind = probe_stream(&test_state(), &format!("http://{addr}/entry")).await;
        assert_eq!(kind, StreamKind::Flv);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_probe_stream_非法URL返回Unknown() {
        let state = test_state();
        assert_eq!(probe_stream(&state, "not-a-url").await, StreamKind::Unknown);
        assert_eq!(
            probe_stream(&state, "ftp://example.com/live").await,
            StreamKind::Unknown
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_广告中继标记识别() {
        let cases = [
            ("http://host/applive/mkt.m3u8", true),
            ("http://host/applive/mkt.m3u8?a=tvzb0011", true),
            ("http://host/applive/byt.m3u8?a=tvzb0011", true),
            ("http://host/applive/yss.m3u8?a=tvzb0011", true),
            ("http://host/applive/zmt.m3u8", true),
            ("http://host/appadhw/byt.m3u8", true),
            ("http://host/applive/byt.m3u8", false),
            ("http://host/applive/yss.m3u8", false),
            ("http://host/live/cctv6md.m3u8?from=zbdq6", false),
            (
                "http://host/live/cctv1.m3u8?jsbt=1&jsbk=2&from=zbdq6",
                false,
            ),
        ];
        for (url, expected) in cases {
            let parsed = Url::parse(url).unwrap();
            assert_eq!(looks_like_ad_manifest(&parsed), expected, "url: {url}");
        }
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_广告中继重定向_重试命中真实清单() {
        let entry_hits = Arc::new(AtomicUsize::new(0));
        let entry_hits_clone = entry_hits.clone();
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/entry.m3u8",
                    get(move || {
                        let entry_hits = entry_hits_clone.clone();
                        async move {
                            let count = entry_hits.fetch_add(1, Ordering::SeqCst);
                            let target = if count == 0 {
                                "/applive/mkt.m3u8"
                            } else {
                                "/live/cctv1md.m3u8?from=zbdq6"
                            };
                            (StatusCode::FOUND, [("location", target)])
                        }
                    }),
                )
                .route(
                    "/applive/mkt.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nad.ts\n",
                        )
                    }),
                )
                .route(
                    "/live/cctv1md.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nreal.ts\n",
                        )
                    }),
                ),
        )
        .await;
        let query = proxy_query(format!("http://{addr}/entry.m3u8"));
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(
            text.contains("real.ts") && !text.contains("ad.ts"),
            "实际输出: {text}"
        );
        assert_eq!(entry_hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_广告重试成功后_刷新清单走缓存真实中继() {
        let entry_hits = Arc::new(AtomicUsize::new(0));
        let entry_hits_clone = entry_hits.clone();
        let real_hits = Arc::new(AtomicUsize::new(0));
        let real_hits_clone = real_hits.clone();
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/entry.m3u8",
                    get(move || {
                        let entry_hits = entry_hits_clone.clone();
                        async move {
                            let count = entry_hits.fetch_add(1, Ordering::SeqCst);
                            let target = if count == 0 {
                                "/applive/mkt.m3u8?a=tvzb0011"
                            } else {
                                "/live/cctv1md.m3u8?from=zbdq6"
                            };
                            (StatusCode::FOUND, [("location", target)])
                        }
                    }),
                )
                .route(
                    "/applive/mkt.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nad.ts\n",
                        )
                    }),
                )
                .route(
                    "/live/cctv1md.m3u8",
                    get(move || {
                        let real_hits = real_hits_clone.clone();
                        async move {
                            real_hits.fetch_add(1, Ordering::SeqCst);
                            (
                                [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                                "#EXTM3U\n#EXTINF:10.0,\nreal.ts\n",
                            )
                        }
                    }),
                ),
        )
        .await;
        let state = test_state();
        let query = proxy_query(format!("http://{addr}/entry.m3u8"));

        // 第一次请求：入口先重定向到广告，重试后命中真实中继。
        let (status, text) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(text.contains("real.ts"), "实际输出: {text}");
        assert_eq!(real_hits.load(Ordering::SeqCst), 1);
        assert_eq!(entry_hits.load(Ordering::SeqCst), 2);

        // 第二次刷新：直接走缓存中的真实中继地址，不再请求广告入口。
        let (status, text) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(text.contains("real.ts"), "实际输出: {text}");
        assert_eq!(entry_hits.load(Ordering::SeqCst), 2);
        assert_eq!(real_hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_缓存广告中继地址被拒绝并重新发现真实中继() {
        let entry_hits = Arc::new(AtomicUsize::new(0));
        let entry_hits_clone = entry_hits.clone();
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/entry.m3u8",
                    get(move || {
                        let entry_hits = entry_hits_clone.clone();
                        async move {
                            let count = entry_hits.fetch_add(1, Ordering::SeqCst);
                            let target = if count == 0 {
                                "/applive/mkt.m3u8?a=tvzb0011"
                            } else {
                                "/live/cctv1md.m3u8?from=zbdq6"
                            };
                            (StatusCode::FOUND, [("location", target)])
                        }
                    }),
                )
                .route(
                    "/applive/mkt.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nad.ts\n",
                        )
                    }),
                )
                .route(
                    "/live/cctv1md.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nreal.ts\n",
                        )
                    }),
                ),
        )
        .await;
        let state = test_state();
        let original = format!("http://{addr}/entry.m3u8");
        // 注入历史错误缓存：广告地址不应被回放，应被拒绝并重新发现真实中继。
        let ad_url = Url::parse(&format!("http://{addr}/applive/mkt.m3u8?a=tvzb0011")).unwrap();
        state.cache_update(&original, &ad_url);
        let query = proxy_query(original);
        let (status, text) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(
            text.contains("real.ts") && !text.contains("ad.ts"),
            "实际输出: {text}"
        );
        assert_eq!(entry_hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_缓存地址失效_清除后重新发现真实中继() {
        let entry_hits = Arc::new(AtomicUsize::new(0));
        let entry_hits_clone = entry_hits.clone();
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/entry.m3u8",
                    get(move || {
                        let entry_hits = entry_hits_clone.clone();
                        async move {
                            let count = entry_hits.fetch_add(1, Ordering::SeqCst);
                            let target = if count == 0 {
                                "/applive/mkt.m3u8?a=tvzb0011"
                            } else {
                                "/live/cctv1md.m3u8?from=zbdq6"
                            };
                            (StatusCode::FOUND, [("location", target)])
                        }
                    }),
                )
                .route(
                    "/applive/mkt.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nad.ts\n",
                        )
                    }),
                )
                .route(
                    "/live/cctv1md.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nreal.ts\n",
                        )
                    }),
                )
                .route(
                    "/live/stale.m3u8",
                    get(|| async { (StatusCode::FORBIDDEN, "signature expired") }),
                ),
        )
        .await;
        let state = test_state();
        let original = format!("http://{addr}/entry.m3u8");
        // 注入过期签名缓存：缓存地址返回 403，应被清除并重新发现真实中继。
        let stale_url = Url::parse(&format!("http://{addr}/live/stale.m3u8?from=zbdq6")).unwrap();
        state.cache_update(&original, &stale_url);
        let query = proxy_query(original);
        let (status, text) = body_of(proxy_request(&state, &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(
            text.contains("real.ts") && !text.contains("ad.ts"),
            "实际输出: {text}"
        );
        assert_eq!(entry_hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理_广告中继重定向_重试全部失败_透传广告清单() {
        let entry_hits = Arc::new(AtomicUsize::new(0));
        let entry_hits_clone = entry_hits.clone();
        let addr = spawn_upstream(
            Router::new()
                .route(
                    "/entry.m3u8",
                    get(move || {
                        let entry_hits = entry_hits_clone.clone();
                        async move {
                            entry_hits.fetch_add(1, Ordering::SeqCst);
                            (StatusCode::FOUND, [("location", "/applive/mkt.m3u8")])
                        }
                    }),
                )
                .route(
                    "/applive/mkt.m3u8",
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            "#EXTM3U\n#EXTINF:10.0,\nad.ts\n",
                        )
                    }),
                ),
        )
        .await;
        let query = proxy_query(format!("http://{addr}/entry.m3u8"));
        let (status, text) =
            body_of(proxy_request(&test_state(), &query, &HeaderMap::new()).await).await;
        assert_eq!(status, StatusCode::OK);
        assert!(text.contains("ad.ts"), "实际输出: {text}");
        assert_eq!(entry_hits.load(Ordering::SeqCst), MANIFEST_AD_RETRIES + 1);
    }
}
