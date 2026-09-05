use thiserror::Error;

/// 核心库统一错误类型，跨领域/应用/基础设施三层的契约。
///
/// - 领域与应用层的公共接口一律返回本类型，避免用 `String` 丢失错误结构；
/// - 基础设施底层适配器可返回本类型（借助 `#[from]` 自动转换底层错误）；
/// - 表现层（组合根/命令）在边界处将本类型转为用户可读的字符串。
#[derive(Debug, Error)]
pub enum CoreError {
    /// 通用错误，携带具体信息。
    #[error("{0}")]
    Message(String),

    // --- 领域用例错误 ---
    #[error("Torrent not found")]
    TorrentNotFound,
    #[error("File not found")]
    FileNotFound,
    #[error("Video file not downloaded or doesn't exist yet")]
    VideoNotDownloaded,
    #[error("Unsupported video format, metadata extraction requires MKV")]
    UnsupportedVideoFormat,
    #[error("Unsupported search engine: {0}")]
    UnsupportedSearchEngine(String),
    #[error("Failed to extract vtt: parse timed out")]
    SubtitleParseTimeout,

    // --- 透传底层错误 ---
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Demux(#[from] matroska_demuxer::DemuxError),
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Xml(#[from] quick_xml::de::DeError),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

impl Clone for CoreError {
    fn clone(&self) -> Self {
        // 底层错误不实现 Clone，克隆时降级为携带展示文本的 Message 变体。
        match self {
            CoreError::Message(msg) => CoreError::Message(msg.clone()),
            CoreError::TorrentNotFound => CoreError::TorrentNotFound,
            CoreError::FileNotFound => CoreError::FileNotFound,
            CoreError::VideoNotDownloaded => CoreError::VideoNotDownloaded,
            CoreError::UnsupportedVideoFormat => CoreError::UnsupportedVideoFormat,
            CoreError::UnsupportedSearchEngine(engine) => {
                CoreError::UnsupportedSearchEngine(engine.clone())
            }
            CoreError::SubtitleParseTimeout => CoreError::SubtitleParseTimeout,
            CoreError::Sqlx(e) => CoreError::Message(e.to_string()),
            CoreError::Io(e) => CoreError::Message(e.to_string()),
            CoreError::Demux(e) => CoreError::Message(e.to_string()),
            CoreError::Reqwest(e) => CoreError::Message(e.to_string()),
            CoreError::Json(e) => CoreError::Message(e.to_string()),
            CoreError::Xml(e) => CoreError::Message(e.to_string()),
            CoreError::Anyhow(e) => CoreError::Message(e.to_string()),
        }
    }
}

impl From<String> for CoreError {
    fn from(s: String) -> Self {
        CoreError::Message(s)
    }
}

impl From<&str> for CoreError {
    fn from(s: &str) -> Self {
        CoreError::Message(s.to_string())
    }
}

/// 序列化为字符串，供 Tauri 命令边界作为可序列化的错误类型返回给前端。
impl serde::Serialize for CoreError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// 核心库结果类型别名。
pub type CoreResult<T> = Result<T, CoreError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 测试_领域错误变体的展示文本() {
        assert_eq!(CoreError::TorrentNotFound.to_string(), "Torrent not found");
        assert_eq!(CoreError::FileNotFound.to_string(), "File not found");
        assert_eq!(
            CoreError::VideoNotDownloaded.to_string(),
            "Video file not downloaded or doesn't exist yet"
        );
        assert_eq!(
            CoreError::UnsupportedVideoFormat.to_string(),
            "Unsupported video format, metadata extraction requires MKV"
        );
        assert_eq!(
            CoreError::UnsupportedSearchEngine("nyaa".into()).to_string(),
            "Unsupported search engine: nyaa"
        );
        assert_eq!(
            CoreError::SubtitleParseTimeout.to_string(),
            "Failed to extract vtt: parse timed out"
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_From字符串与通用变体() {
        let from_string: CoreError = "外部错误".to_string().into();
        assert!(matches!(from_string, CoreError::Message(m) if m == "外部错误"));
        let from_str: CoreError = "字面量错误".into();
        assert!(matches!(from_str, CoreError::Message(m) if m == "字面量错误"));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_Clone行为() {
        let io_err: CoreError = std::io::Error::other("io 失败").into();
        let cloned = io_err.clone();
        assert_eq!(cloned.to_string(), "io 失败");

        let msg = CoreError::Message("内容".to_string());
        assert_eq!(msg.clone().to_string(), "内容");

        assert_eq!(
            CoreError::TorrentNotFound.clone().to_string(),
            "Torrent not found"
        );
        assert_eq!(
            CoreError::FileNotFound.clone().to_string(),
            "File not found"
        );
        assert_eq!(
            CoreError::VideoNotDownloaded.clone().to_string(),
            "Video file not downloaded or doesn't exist yet"
        );
        assert_eq!(
            CoreError::UnsupportedVideoFormat.clone().to_string(),
            "Unsupported video format, metadata extraction requires MKV"
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_Xml变体转换与Clone() {
        #[derive(serde::Deserialize, Debug)]
        struct Dummy {
            #[allow(dead_code)]
            value: u32,
        }

        let de_err = quick_xml::de::from_str::<Dummy>("<invalid>").unwrap_err();
        let err: CoreError = de_err.into();
        assert!(matches!(err, CoreError::Xml(_)));

        let cloned = err.clone();
        assert!(matches!(cloned, CoreError::Message(_)));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_错误序列化为JSON字符串() {
        assert_eq!(
            serde_json::to_string(&CoreError::TorrentNotFound).unwrap(),
            "\"Torrent not found\""
        );
        assert_eq!(
            serde_json::to_string(&CoreError::Message("自定义错误".into())).unwrap(),
            "\"自定义错误\""
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_Demux变体转换与Clone() {
        let err: CoreError = matroska_demuxer::DemuxError::InvalidEbmlElementId.into();
        assert!(matches!(err, CoreError::Demux(_)));
        assert_eq!(err.to_string(), "invalid EBML Element ID was found");
        assert!(matches!(err.clone(), CoreError::Message(_)));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_Anyhow变体转换与Clone() {
        let err: CoreError = anyhow::anyhow!("librqbit 底层错误").into();
        assert!(matches!(err, CoreError::Anyhow(_)));
        assert_eq!(err.to_string(), "librqbit 底层错误");
        assert!(matches!(err.clone(), CoreError::Message(_)));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_补齐其余底层错误转换与Clone分支() {
        let sqlx_err: CoreError = sqlx::Error::RowNotFound.into();
        assert!(matches!(sqlx_err, CoreError::Sqlx(_)));
        assert!(matches!(sqlx_err.clone(), CoreError::Message(_)));

        let reqwest_err = reqwest::Client::new()
            .get("http://[::1")
            .build()
            .unwrap_err();
        let err: CoreError = reqwest_err.into();
        assert!(matches!(err, CoreError::Reqwest(_)));
        assert!(matches!(err.clone(), CoreError::Message(_)));

        let json_err: CoreError = serde_json::from_str::<u32>("not-a-number")
            .unwrap_err()
            .into();
        assert!(matches!(json_err, CoreError::Json(_)));
        assert!(matches!(json_err.clone(), CoreError::Message(_)));

        let xml_err: CoreError = quick_xml::de::from_str::<u32>("<root>").unwrap_err().into();
        assert!(matches!(xml_err, CoreError::Xml(_)));
        assert!(matches!(xml_err.clone(), CoreError::Message(_)));

        let unsupported = CoreError::UnsupportedSearchEngine("nyaa".to_string());
        assert!(
            matches!(unsupported.clone(), CoreError::UnsupportedSearchEngine(s) if s == "nyaa")
        );

        let timeout = CoreError::SubtitleParseTimeout;
        assert_eq!(
            timeout.clone().to_string(),
            "Failed to extract vtt: parse timed out"
        );
    }

    #[test]
    fn 测试_错误可转换为底层std错误链() {
        let err: CoreError = std::io::Error::new(std::io::ErrorKind::NotFound, "找不到文件").into();
        let boxed: Box<dyn std::error::Error> = Box::new(err);
        assert_eq!(boxed.to_string(), "找不到文件");
    }
}
