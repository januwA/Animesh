import { selectError } from "@videojs/react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { JsPlayer } from "./player";

export function JsPlayerErrorMonitor() {
  const errorState = JsPlayer.usePlayer(selectError);
  const { logger } = useDI();
  const monitorLogger = useMemo(() => logger.withCategory("Player"), [logger]);
  const lastErrorRef = useRef<object | null>(null);

  useEffect(() => {
    const error = errorState?.error ?? null;
    if (error) {
      // v8 ignore next
      if (lastErrorRef.current === error) return;
      lastErrorRef.current = error;
      monitorLogger.error("Video element error:", error);

      let errorMsg = "视频加载失败";
      if (error.code === 4) {
        errorMsg =
          "当前浏览器不支持播放该格式（例如 MKV 容器），建议点击上方按钮\u201c用系统播放器播放\u201d。";
      } else if (error.code === 3) {
        errorMsg = "视频解码失败，可能数据已损坏或编码不支持。";
      } else if (error.code === 2) {
        errorMsg = "视频加载超时或网络断开。";
      }
      toast.error(errorMsg, { duration: 8000 });
      errorState?.dismissError?.();
    } else {
      lastErrorRef.current = null;
    }
  }, [errorState?.error, monitorLogger, errorState?.dismissError]);

  return null;
}
