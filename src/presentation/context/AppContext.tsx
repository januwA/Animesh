import { createContext, use, useState } from "react";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";

interface AppContextType {
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
	const [calendar, setCalendar] = useState<BangumiCalendarDay[]>([]);
	const [calendarActiveDay, setCalendarActiveDay] = useState<number | null>(
		null,
	);

	return (
		<AppContext
			value={{
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
