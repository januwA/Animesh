use crate::domain::stream::{proxy_base_url, ResolvedStream, StreamProber};
use crate::error::CoreResult;
use crate::infrastructure::local_ip::get_local_ip;
use std::sync::Arc;

/// 流媒体用例:直播源解析与对前端公开的代理地址生成。
///
/// 持有流探测能力与流媒体服务器端口,不依赖任何种子或设置仓储。
pub struct StreamService {
    stream_prober: Arc<dyn StreamProber>,
    port: u16,
}

impl StreamService {
    pub fn new(stream_prober: Arc<dyn StreamProber>, port: u16) -> Self {
        Self {
            stream_prober,
            port,
        }
    }

    /// 流媒体服务器监听端口。
    pub fn port(&self) -> u16 {
        self.port
    }

    /// 探测直播源类型并返回可直接播放的代理地址。
    pub async fn resolve_stream(&self, raw_url: &str) -> CoreResult<ResolvedStream> {
        let kind = self.stream_prober.probe(raw_url).await;
        Ok(ResolvedStream {
            proxy_url: proxy_base_url(self.port),
            kind,
        })
    }

    /// 生成对前端公开的 IPTV 代理基础地址。
    pub fn proxy_base_url(&self) -> String {
        proxy_base_url(self.port)
    }

    /// 生成种子文件的流式播放地址,自动选择本机最佳局域网 IP。
    pub fn get_stream_url(&self, info_hash_hex: &str, file_id: usize) -> String {
        let host = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
        format!(
            "http://{}:{}/stream/{}/{}",
            host, self.port, info_hash_hex, file_id
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::stream::StreamKind;
    use crate::infrastructure::test_mocks::MockStreamProber;

    fn build_service(kind: StreamKind, port: u16) -> StreamService {
        StreamService::new(Arc::new(MockStreamProber(kind)), port)
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_代理基础地址与解析直播流() {
        let service = build_service(StreamKind::Hls, 45678);

        let base = service.proxy_base_url();
        assert!(base.contains("45678"));
        assert!(base.contains("/iptv-proxy"));

        let resolved = service.resolve_stream("http://example.com/live").await;
        let resolved = resolved.expect("解析应成功");
        assert_eq!(resolved.kind, StreamKind::Hls);
        assert_eq!(resolved.proxy_url, base);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_解析直播流_返回代理地址与类型() {
        let service = build_service(StreamKind::Hls, 45679);

        let resolved = service
            .resolve_stream("http://example.com/live.m3u8")
            .await
            .expect("解析应成功");
        assert!(resolved.proxy_url.contains("45679"));
        assert!(resolved.proxy_url.contains("/iptv-proxy"));
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_流地址_包含端口与哈希() {
        let service = build_service(StreamKind::Hls, 45680);
        let test_hash = "3a2a3e0f438a2e1d74381395bb0e6840742fef8e";
        let url = service.get_stream_url(test_hash, 0);
        assert!(url.contains("45680"));
        assert!(url.contains(test_hash));
        assert!(url.contains("/stream/"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_端口读取() {
        let service = build_service(StreamKind::Hls, 45681);
        assert_eq!(service.port(), 45681);
    }
}
