import { useTheme } from "next-themes";
import { useEffect } from "react";
import type { NotifyDownloadCompletionUseCase } from "@/application/notification/NotifyDownloadCompletionUseCase";
import type { RequestNotificationPermissionUseCase } from "@/application/notification/RequestNotificationPermissionUseCase";
import type { SetThemeUseCase } from "@/application/settings/SetThemeUseCase";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";

/** useGlobalEffects 的依赖，由调用方（应用外壳组合根）注入 */
export interface UseGlobalEffectsDeps {
  requestNotificationPermissionUseCase: Pick<
    RequestNotificationPermissionUseCase,
    "execute"
  >;
  notifyDownloadCompletionUseCase: Pick<
    NotifyDownloadCompletionUseCase,
    "execute"
  >;
  setThemeUseCase: Pick<SetThemeUseCase, "execute">;
}

export function useGlobalEffects(deps: UseGlobalEffectsDeps) {
  const {
    requestNotificationPermissionUseCase,
    notifyDownloadCompletionUseCase,
    setThemeUseCase,
  } = deps;
  const { theme } = useTheme();
  const { torrents, isLoading } = useTorrentStatus();

  // 同步主题到 Tauri 原生窗口标题栏
  useEffect(() => {
    const syncTheme = async () => {
      await setThemeUseCase.execute(theme);
    };
    syncTheme();
  }, [theme, setThemeUseCase]);

  // 请求系统通知权限
  useEffect(() => {
    requestNotificationPermissionUseCase.execute();
  }, [requestNotificationPermissionUseCase]);

  // 下载完成监听（通过全局 TorrentStatusContext 消费数据，无需独立订阅）
  useEffect(() => {
    if (isLoading) return;
    notifyDownloadCompletionUseCase.execute(torrents);
  }, [torrents, isLoading, notifyDownloadCompletionUseCase]);
}
