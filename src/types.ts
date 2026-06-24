export interface SearchResultItem {
	title: string;
	link: string;
	pub_date: string;
	magnet: string;
	size: number | null;
}

export interface ToastMessage {
	id: number;
	text: string;
}

export interface FileDetails {
	id: number;
	name: string;
	len: number;
}

export interface AddTorrentResult {
	info_hash: string;
	name: string | null;
	files: FileDetails[];
}

export interface TorrentStatusInfo {
	info_hash: string;
	name: string | null;
	progress_bytes: number;
	total_bytes: number;
	finished: boolean;
	download_speed_bytes_per_sec: number;
	paused: boolean;
}

export interface SubtitleTrackInfo {
	id: number;
	language: string;
	title: string;
	codec: string;
}
