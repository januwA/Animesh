import { invoke } from "@tauri-apps/api/core";
import { type FormEvent, useEffect, useRef, useState } from "react";
import "./App.css";

interface SearchResultItem {
	title: string;
	link: string;
	pub_date: string;
	magnet: string;
	size: number | null;
}

interface ToastMessage {
	id: number;
	text: string;
}

interface FileDetails {
	id: number;
	name: string;
	len: number;
}

interface AddTorrentResult {
	info_hash: string;
	name: string | null;
	files: FileDetails[];
}

interface TorrentStatusInfo {
	info_hash: string;
	name: string | null;
	progress_bytes: number;
	total_bytes: number;
	finished: boolean;
	download_speed_bytes_per_sec: number;
}

function App() {
	const [keyword, setKeyword] = useState("");
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
	const [hasSearched, setHasSearched] = useState(false);

	// 边下边播状态
	const [isResolvingMagnet, setIsResolvingMagnet] = useState(false);
	const [activeTorrent, setActiveTorrent] = useState<AddTorrentResult | null>(
		null,
	);
	const [activeFileId, setActiveFileId] = useState<number | null>(null);
	const [streamUrl, setStreamUrl] = useState<string | null>(null);
	const [torrentStatus, setTorrentStatus] = useState<TorrentStatusInfo | null>(
		null,
	);

	const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const showToast = (text: string) => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, text }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((toast) => toast.id !== id));
		}, 3000);
	};

	// 自动清除轮询
	useEffect(() => {
		return () => {
			if (statusIntervalRef.current) {
				clearInterval(statusIntervalRef.current);
			}
		};
	}, []);

	async function handleSearch(e: FormEvent) {
		e.preventDefault();
		if (!keyword.trim()) return;

		setLoading(true);
		setError(null);
		setHasSearched(true);

		try {
			const data = await invoke<SearchResultItem[]>("search_dmhy", {
				keyword: keyword.trim(),
			});
			setResults(data);
		} catch (err) {
			console.error("Search failed:", err);
			setError(typeof err === "string" ? err : "搜索失败，请检查网络或重试");
			setResults([]);
		} finally {
			setLoading(false);
		}
	}

	const handleCopyMagnet = async (magnet: string) => {
		try {
			await navigator.clipboard.writeText(magnet);
			showToast("磁力链接已复制到剪贴板");
		} catch {
			showToast("复制失败，请手动复制");
		}
	};

	const handlePlay = async (magnet: string, title: string) => {
		setIsResolvingMagnet(true);
		showToast(`正在启动下载流媒体引擎: ${title.slice(0, 20)}...`);
		try {
			const result = await invoke<AddTorrentResult>("torrent_add_magnet", {
				magnet,
			});
			setActiveTorrent(result);
			showToast(`种子元数据解析成功，获取到 ${result.files.length} 个文件`);
		} catch (err) {
			console.error("Failed to add torrent:", err);
			showToast(
				`种子解析失败: ${typeof err === "string" ? err : "错误详情请见控制台"}`,
			);
		} finally {
			setIsResolvingMagnet(false);
		}
	};

	const startPlayback = async (fileId: number) => {
		if (!activeTorrent) return;
		try {
			const url = await invoke<string>("torrent_get_stream_url", {
				infoHash: activeTorrent.info_hash,
				fileId,
			});
			setStreamUrl(url);
			setActiveFileId(fileId);

			// 获取初始状态
			const initialStatus = await invoke<TorrentStatusInfo>(
				"torrent_get_status",
				{
					infoHash: activeTorrent.info_hash,
				},
			);
			setTorrentStatus(initialStatus);

			// 启动轮询
			statusIntervalRef.current = setInterval(async () => {
				try {
					const status = await invoke<TorrentStatusInfo>("torrent_get_status", {
						infoHash: activeTorrent.info_hash,
					});
					setTorrentStatus(status);
				} catch (err) {
					console.error("Failed to fetch torrent status:", err);
				}
			}, 1500);
		} catch (err) {
			console.error("Failed to start playback:", err);
			showToast("无法获取视频流，启动播放失败");
		}
	};

	const handleCopyStreamUrl = async () => {
		if (!streamUrl) return;
		try {
			await navigator.clipboard.writeText(streamUrl);
			showToast("视频流地址已复制到剪贴板，可在外部播放器中播放");
		} catch {
			showToast("复制失败，请手动复制");
		}
	};

	const handleClosePlayer = () => {
		if (statusIntervalRef.current) {
			clearInterval(statusIntervalRef.current);
			statusIntervalRef.current = null;
		}
		setActiveFileId(null);
		setStreamUrl(null);
		setTorrentStatus(null);
	};

	const handleCloseModal = () => {
		handleClosePlayer();
		setActiveTorrent(null);
	};

	function formatBytes(bytes: number | null | undefined): string {
		if (bytes === null || bytes === undefined || bytes === 0) return "未知大小";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	}

	return (
		<main className="container">
			<header className="header">
				<h1 className="title-gradient">Animesh</h1>
				<p className="subtitle">BT 边下边播 & 磁力聚合搜索客户端</p>
			</header>

			<section className="search-container">
				<form onSubmit={handleSearch} className="search-form">
					<input
						id="search-input"
						className="search-input"
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
						placeholder="输入动漫名称，例如：凡人修仙传..."
						disabled={loading}
					/>
					<button
						type="submit"
						className="search-button"
						disabled={loading || !keyword.trim()}
					>
						{loading ? "搜索中..." : "搜索"}
					</button>
				</form>
			</section>

			{loading && (
				<div className="status-container">
					<div className="spinner" />
					<p className="status-text">正在获取 动漫花园 资源列表...</p>
				</div>
			)}

			{error && (
				<div className="status-container">
					<div className="error-box">
						<p>{error}</p>
					</div>
				</div>
			)}

			{!loading && !error && hasSearched && results.length === 0 && (
				<div className="status-container">
					<p className="status-text">未找到相关资源，请换个关键词试试</p>
				</div>
			)}

			{!loading && !error && results.length > 0 && (
				<section>
					<div className="results-header">
						<div className="results-count">
							找到 <span>{results.length}</span> 个资源
						</div>
					</div>

					<div className="results-list">
						{results.map((item, index) => (
							<div
								className="torrent-card"
								key={index.toString()}
								id={`torrent-item-${index}`}
							>
								<h3 className="torrent-title">{item.title}</h3>
								<div className="torrent-meta">
									<div className="meta-item">
										<span className="meta-icon">📅</span>
										<span>{item.pub_date}</span>
									</div>
									<div className="meta-item">
										<span className="meta-icon">💾</span>
										<span>{formatBytes(item.size)}</span>
									</div>
								</div>
								<div className="torrent-actions">
									<a
										href={String(item.link)}
										target="_blank"
										rel="noopener noreferrer"
										className="btn-action btn-link"
										title="在浏览器中打开网页"
									>
										🌐 网页
									</a>
									<button
										type="button"
										onClick={() => handleCopyMagnet(item.magnet)}
										className="btn-action btn-copy"
									>
										🧲 复制磁力
									</button>
									<button
										type="button"
										onClick={() => handlePlay(item.magnet, item.title)}
										className="btn-action btn-play"
									>
										▶ 边下边播
									</button>
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* 磁力元数据解析 Loading 遮罩 */}
			{isResolvingMagnet && (
				<div className="modal-overlay" style={{ zIndex: 100 }}>
					<div className="modal-content" style={{ maxWidth: "400px" }}>
						<div
							className="modal-body"
							style={{ textAlign: "center", padding: "2.5rem 2rem" }}
						>
							<div
								className="spinner"
								style={{ margin: "0 auto 1.5rem auto" }}
							/>
							<p
								className="status-text"
								style={{ fontSize: "1.05rem", fontWeight: 500 }}
							>
								正在启动下载引擎并解析种子...
							</p>
							<p
								style={{
									fontSize: "0.85rem",
									color: "var(--text-muted)",
									marginTop: "0.75rem",
								}}
							>
								首次连接 Peer 并下载 Metadata 可能需要较长时间，请稍等
							</p>
						</div>
					</div>
				</div>
			)}

			{/* 种子文件列表 & 播放播放器面板弹窗 */}
			{activeTorrent && (
				<div className="modal-overlay">
					<div className="modal-content">
						<div className="modal-header">
							<h2
								className="modal-title"
								title={activeTorrent.name || "未命名种子"}
							>
								{activeTorrent.name || "未命名种子"}
							</h2>
							<button
								type="button"
								className="btn-close"
								onClick={handleCloseModal}
							>
								✕
							</button>
						</div>
						<div className="modal-body">
							{activeFileId === null ? (
								<div className="file-list-container">
									<h3
										style={{
											margin: "0 0 1rem 0",
											fontSize: "1.1rem",
											color: "var(--text-primary)",
										}}
									>
										选择要播放的文件：
									</h3>
									<div className="file-list">
										{activeTorrent.files.map((file) => (
											<div key={file.id} className="file-item">
												<div className="file-info">
													<span className="file-name">{file.name}</span>
													<span className="file-size">
														{formatBytes(file.len)}
													</span>
												</div>
												<button
													type="button"
													className="btn-action btn-play"
													onClick={() => startPlayback(file.id)}
												>
													▶ 播放
												</button>
											</div>
										))}
									</div>
								</div>
							) : (
								<div className="player-container">
									<div className="video-wrapper">
										{streamUrl && (
											<>
												{/* biome-ignore lint/a11y/useMediaCaption: no captions for local torrent stream */}
												<video
													src={streamUrl}
													controls
													autoPlay
													className="video-viewport"
												/>
											</>
										)}
									</div>

									<div className="playback-controls">
										<div className="progress-info">
											<span>
												下载进度:{" "}
												{torrentStatus
													? `${((torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100).toFixed(2)}%`
													: "计算中..."}
											</span>
											<span>
												速度:{" "}
												{torrentStatus
													? `${formatBytes(torrentStatus.download_speed_bytes_per_sec)}/s`
													: "0 B/s"}
											</span>
										</div>

										<div className="progress-track">
											<div
												className="progress-fill"
												style={{
													width: torrentStatus
														? `${(torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100}%`
														: "0%",
												}}
											/>
										</div>

										<div className="stats-grid">
											<div className="stat-card">
												<span className="stat-label">已下载</span>
												<span className="stat-value">
													{torrentStatus
														? formatBytes(torrentStatus.progress_bytes)
														: "0 B"}
												</span>
											</div>
											<div className="stat-card">
												<span className="stat-label">总大小</span>
												<span className="stat-value">
													{torrentStatus
														? formatBytes(torrentStatus.total_bytes)
														: "0 B"}
												</span>
											</div>
											<div className="stat-card">
												<span className="stat-label">状态</span>
												<span className="stat-value">
													{torrentStatus
														? torrentStatus.finished
															? "已完成"
															: "正在缓存..."
														: "连接中..."}
												</span>
											</div>
										</div>

										<div className="codec-notice">
											<span>💡</span>
											<div>
												<strong>播放提示：</strong>
												Tauri 内置网页浏览器支持直接播放主流{" "}
												<strong>MP4 (H.264)</strong> 格式。 如果视频无法加载（如
												MKV、HEVC/H.265 等格式），您可以复制下方流地址，在
												VLC、PotPlayer 等外部播放器中直接打开播放：
											</div>
										</div>

										<div className="player-actions">
											<button
												type="button"
												className="btn-action btn-copy"
												onClick={handleCopyStreamUrl}
											>
												📋 复制视频流地址
											</button>
											<button
												type="button"
												className="btn-action btn-copy"
												style={{ background: "rgba(255,255,255,0.05)" }}
												onClick={handleClosePlayer}
											>
												⬅ 返回文件列表
											</button>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			<div className="toast-container">
				{toasts.map((toast) => (
					<div key={toast.id.toString()} className="toast">
						<span>🔔</span>
						<span>{toast.text}</span>
					</div>
				))}
			</div>
		</main>
	);
}

export default App;
