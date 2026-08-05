import { useEffect, useState } from "react";

export const ACCENT_PRESETS = [
	{ id: "indigo", label: "靛蓝", color: "oklch(0.6 0.18 245)" },
	{ id: "sky", label: "青蓝", color: "oklch(0.6 0.18 200)" },
	{ id: "emerald", label: "翠绿", color: "oklch(0.6 0.18 160)" },
	{ id: "rose", label: "玫瑰", color: "oklch(0.6 0.18 355)" },
	{ id: "amber", label: "琥珀", color: "oklch(0.6 0.18 85)" },
] as const;

export type AccentId = (typeof ACCENT_PRESETS)[number]["id"];

export const ACCENT_STORAGE_KEY = "animesh-accent";

const DEFAULT_ACCENT: AccentId = "indigo";

export function isAccentId(value: unknown): value is AccentId {
	return ACCENT_PRESETS.some((preset) => preset.id === value);
}

export function getStoredAccent(): AccentId {
	const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
	return isAccentId(stored) ? stored : DEFAULT_ACCENT;
}

export function applyAccent(id: AccentId): void {
	document.documentElement.dataset.accent = id;
}

export function useAccentTheme() {
	const [accent, setAccentState] = useState<AccentId>(getStoredAccent);

	useEffect(() => {
		applyAccent(accent);
	}, [accent]);

	const setAccent = (id: AccentId) => {
		setAccentState(id);
		window.localStorage.setItem(ACCENT_STORAGE_KEY, id);
	};

	return { accent, setAccent };
}
