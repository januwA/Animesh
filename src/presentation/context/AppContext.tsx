import { createContext, use, useCallback, useState } from "react";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastMessage {
	id: number;
	text: string;
	type: ToastType;
}

interface AppContextType {
	toasts: ToastMessage[];
	showToast: (
		text: string,
		typeOrDuration?: ToastType | number,
		duration?: number,
	) => void;
	removeToast: (id: number) => void;
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
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
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
				toasts,
				showToast,
				removeToast,
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
