import { createContext, useContext } from "react";

export interface SettingsLoaderContextType {
  isTauri: boolean;
  isMobile: boolean;
  loading: boolean;
  currentVersion: string;
}

export const SettingsLoaderContext = createContext<
  SettingsLoaderContextType | undefined
>(undefined);

export function useSettingsLoader(): SettingsLoaderContextType {
  const ctx = useContext(SettingsLoaderContext);
  if (!ctx) {
    throw new Error(
      "useSettingsLoader 必须在 SettingsLoaderContext.Provider 内使用",
    );
  }
  return ctx;
}
