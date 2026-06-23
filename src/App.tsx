import { invoke } from "@tauri-apps/api/core";
import { type FormEvent, useState } from "react";
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

function App() {
	const [keyword, setKeyword] = useState("");
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
	const [hasSearched, setHasSearched] = useState(false);

	const showToast = (text: string) => {
		const id = Date.now();
		setToasts((prev) => [...prev, { id, text }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((toast) => toast.id !== id));
		}, 3000);
	};

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

	const handlePlay = (title: string) => {
		showToast(`正在启动下载流媒体引擎: ${title.slice(0, 20)}...`);
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
										onClick={() => handlePlay(item.title)}
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
