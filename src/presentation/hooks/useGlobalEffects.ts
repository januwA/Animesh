import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useDI } from "@/di/DIContext";

export function useGlobalEffects() {
  const { setThemeUseCase } = useDI();
  const { theme } = useTheme();

  // 同步主题到 Tauri 原生窗口标题栏
  useEffect(() => {
    setThemeUseCase.execute(theme);
  }, [theme, setThemeUseCase]);
}
