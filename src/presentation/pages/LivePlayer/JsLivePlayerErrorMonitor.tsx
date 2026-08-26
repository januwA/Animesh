import { createPlayer, liveVideoFeatures, selectError } from "@videojs/react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { Logger } from "@/domain/logger/logger";

export const JsLivePlayer = createPlayer({ features: liveVideoFeatures });

interface JsLivePlayerErrorMonitorProps {
  logger: Pick<Logger, "withCategory">;
  onRecover: () => void;
}

export function JsLivePlayerErrorMonitor({
  logger,
  onRecover,
}: JsLivePlayerErrorMonitorProps) {
  const errorState = JsLivePlayer.usePlayer(selectError);
  const monitorLogger = useMemo(
    () => logger.withCategory("LivePlayer"),
    [logger],
  );
  const lastErrorRef = useRef<object | null>(null);

  useEffect(() => {
    const error = errorState?.error ?? null;
    if (error) {
      // v8 ignore next
      if (lastErrorRef.current === error) return;
      lastErrorRef.current = error;
      monitorLogger.error("Live video element error:", error);

      let errorMsg = "直播流加载失败";
      if (error.code === 4) {
        errorMsg = "当前浏览器不支持播放该直播源。";
      } else if (error.code === 3) {
        errorMsg = "直播流解码失败，可能源地址已失效或编码不支持。";
      } else if (error.code === 2) {
        errorMsg = "直播流加载超时或网络断开。";
      }
      toast.error(errorMsg, { duration: 8000 });

      if (error.code === 2 || error.code === 3) {
        onRecover();
      }
      errorState?.dismissError?.();
    } else {
      lastErrorRef.current = null;
    }
  }, [errorState?.error, monitorLogger, errorState?.dismissError, onRecover]);

  return null;
}
