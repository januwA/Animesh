import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useDI } from "@/di/DIContext";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";

export function useGlobalEffects() {
  const {
    notificationRepository,
    notifyDownloadCompletionUseCase,
    setThemeUseCase,
  } = useDI();
  const { resolvedTheme } = useTheme();
  const { torrents, isLoading } = useTorrentStatus();

  // 同步主题到 Tauri 原生窗口标题栏
  useEffect(() => {
    const syncTheme = async () => {
      if (resolvedTheme === "dark" || resolvedTheme === "light") {
        try {
          await setThemeUseCase.execute(resolvedTheme);
        } catch {}
      }
    };
    syncTheme();
  }, [resolvedTheme, setThemeUseCase]);

  // 请求系统通知权限
  useEffect(() => {
    notificationRepository.requestPermission();
  }, [notificationRepository]);

  // 下载完成监听（通过全局 TorrentStatusContext 消费数据，无需独立订阅）
  useEffect(() => {
    if (isLoading) return;
    notifyDownloadCompletionUseCase.execute(torrents);
  }, [torrents, isLoading, notifyDownloadCompletionUseCase]);
}
