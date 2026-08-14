use async_trait::async_trait;
use serde::Serialize;

/// 内嵌流媒体服务器上对外暴露的 IPTV HLS 代理路径。
pub const IPTV_PROXY_PATH: &str = "/iptv-proxy";

/// 生成对前端公开的代理基础地址，前端在该地址后追加 `?url=` 即可发起代理请求。
pub fn proxy_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}{IPTV_PROXY_PATH}")
}

/// 流类型判定结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StreamKind {
    Hls,
    Flv,
    Unknown,
}

/// 已解析的直播源，返回给表现层使用。
#[derive(Serialize)]
pub struct ResolvedStream {
    pub proxy_url: String,
    pub kind: StreamKind,
}

/// 直播流探测能力，由基础设施层（HLS 代理）实现。
#[async_trait]
pub trait StreamProber: Send + Sync {
    async fn probe(&self, raw_url: &str) -> StreamKind;
}
