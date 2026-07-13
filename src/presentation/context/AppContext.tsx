import { createContext, use, useCallback, useState } from "react";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastMessage {
	id: number;
	text: string;
	type: ToastType;
}

interface AppContextType {
	keyword: string;
	setKeyword: (val: string) => void;
	results: AiSearchResultItem[];
	setResults: (val: AiSearchResultItem[]) => void;
	loading: boolean;
	setLoading: (val: boolean) => void;
	error: string | null;
	setError: (val: string | null) => void;
	hasSearched: boolean;
	setHasSearched: (val: boolean) => void;
	toasts: ToastMessage[];
	showToast: (
		text: string,
		typeOrDuration?: ToastType | number,
		duration?: number,
	) => void;
	removeToast: (id: number) => void;
	searchEngine: string;
	setSearchEngine: (val: string) => void;
	calendar: BangumiCalendarDay[];
	setCalendar: (val: BangumiCalendarDay[]) => void;
	calendarActiveDay: number | null;
	setCalendarActiveDay: (val: number | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [keyword, setKeyword] = useState("");
	const [results, setResults] = useState<AiSearchResultItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasSearched, setHasSearched] = useState(false);
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
	const [searchEngine, setSearchEngine] = useState("dmhy");
	const [calendar, setCalendar] = useState<BangumiCalendarDay[]>([]);
	const [calendarActiveDay, setCalendarActiveDay] = useState<number | null>(
		null,
	);

	const showToast = useCallback(
		(text: string, typeOrDuration?: ToastType | number, duration = 3000) => {
			const id = Date.now() + Math.random();
			let toastType: ToastType = "info";
			let toastDuration = duration;

			if (typeof typeOrDuration === "number") {
				toastDuration = typeOrDuration;
			} else if (typeOrDuration) {
				toastType = typeOrDuration;
			}

			setToasts((prev) => [...prev, { id, text, type: toastType }]);
			setTimeout(() => {
				setToasts((prev) => prev.filter((toast) => toast.id !== id));
			}, toastDuration);
		},
		[],
	);

	const removeToast = useCallback((id: number) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	return (
		<AppContext
			value={{
				keyword,
				setKeyword,
				results,
				setResults,
				loading,
				setLoading,
				error,
				setError,
				hasSearched,
				setHasSearched,
				toasts,
				showToast,
				removeToast,
				searchEngine,
				setSearchEngine,
				calendar,
				setCalendar,
				calendarActiveDay,
				setCalendarActiveDay,
			}}
		>
			{children}
		</AppContext>
	);
}

export function useAppContext() {
	const context = use(AppContext);
	if (context === undefined) {
		throw new Error("useAppContext must be used within an AppContextProvider");
	}
	return context;
}
