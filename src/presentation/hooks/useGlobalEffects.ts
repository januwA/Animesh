import { useTheme } from "next-themes";
import { useEffect } from "react";
import type { RequestNotificationPermissionUseCase } from "@/application/notification/RequestNotificationPermissionUseCase";
import type { SetThemeUseCase } from "@/application/settings/SetThemeUseCase";

/** useGlobalEffects 的依赖，由调用方（应用外壳组合根）注入 */
export interface UseGlobalEffectsDeps {
  requestNotificationPermissionUseCase: Pick<
    RequestNotificationPermissionUseCase,
    "execute"
  >;
  setThemeUseCase: Pick<SetThemeUseCase, "execute">;
}

export function useGlobalEffects(deps: UseGlobalEffectsDeps) {
  const { requestNotificationPermissionUseCase, setThemeUseCase } = deps;
  const { theme } = useTheme();

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
}
