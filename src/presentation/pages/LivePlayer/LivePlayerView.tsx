import { Clipboard, Link2, Loader2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ResolvePlayableStreamUrlUseCase } from "@/application/iptv/ResolvePlayableStreamUrlUseCase";
import type { ResolvedStreamUrl } from "@/domain/iptv/IptvStreamUrlRepository";
import type { Logger } from "@/domain/logger/logger";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { useQuery } from "@/presentation/hooks/useQuery";
import "@videojs/react/video/skin.css";
import {
  HlsJsVideo,
  type HlsJsVideoProps,
} from "@videojs/react/media/hlsjs-video";
import { VideoSkin } from "@videojs/react/video";
import { LazyImage } from "@/presentation/components/LazyImage";
import { MpegtsVideo } from "@/presentation/components/MpegtsVideo";
import {
  JsLivePlayer,
  JsLivePlayerErrorMonitor,
} from "./JsLivePlayerErrorMonitor";
import { LivePlayerBackButton } from "./LivePlayerBackButton";

type HlsMediaConfig = NonNullable<HlsJsVideoProps["config"]>;

const MAX_RECOVERIES = 5;

export interface UseLivePlayerViewParams {
  resolvePlayableStreamUrlUseCase: Pick<
    ResolvePlayableStreamUrlUseCase,
    "execute"
  >;
  logger: Pick<Logger, "withCategory">;
}

interface LivePlayerViewProps {
  url: string;
  name: string;
  logo: string;
  category: string;
  deps: UseLivePlayerViewParams;
}

export function LivePlayerView({
  url,
  name,
  logo,
  category,
  deps,
}: LivePlayerViewProps) {
  const { resolvePlayableStreamUrlUseCase, logger } = deps;
  const [reloadKey, setReloadKey] = useState(0);
  const recoveriesRef = useRef(0);

  const { data: resolvedStream } = useQuery(
    (_ctx) =>
      resolvePlayableStreamUrlUseCase.execute(url).catch(
        () =>
          ({
            url,
            kind: "unknown",
          }) as ResolvedStreamUrl,
      ),
    [url, resolvePlayableStreamUrlUseCase],
  );

  const hlsMediaConfig = useMemo<HlsMediaConfig>(
    () => ({
      hlsJs: {
        enableWorker: true,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 20,
        fragLoadingRetryDelay: 200,
        fragLoadingMaxRetryTimeout: 60000,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 300,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 300,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        maxBufferLength: 30,
        backBufferLength: 30,
      },
    }),
    [],
  );

  const handleRecover = useCallback(() => {
    // v8 ignore next
    if (recoveriesRef.current >= MAX_RECOVERIES) return;
    recoveriesRef.current += 1;
    toast("直播流中断，正在自动重连...");
    setReloadKey((key) => key + 1);
  }, []);

  const handleCopyRawUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("直播源地址已复制，可添加到代理规则中");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 lg:gap-6 animate-in fade-in duration-300">
      <LivePlayerBackButton />

      <div className="relative w-full aspect-video max-h-dvh overflow-hidden rounded-xl">
        {resolvedStream ? (
          resolvedStream.kind === "flv" ? (
            <MpegtsVideo
              key={reloadKey}
              src={resolvedStream.url}
              autoplay
              onError={handleRecover}
            />
          ) : (
            <JsLivePlayer.Provider>
              <VideoSkin className="w-full h-full">
                <HlsJsVideo
                  key={reloadKey}
                  src={resolvedStream.url}
                  streamType="live"
                  config={hlsMediaConfig}
                  playsInline
                />
              </VideoSkin>
              <JsLivePlayerErrorMonitor
                logger={logger}
                onRecover={handleRecover}
              />
            </JsLivePlayer.Provider>
          )
        ) : (
          <div className="flex items-center justify-center gap-3 h-full text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">正在加载直播源...</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {logo && (
            <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
              <LazyImage src={logo} alt={name} />
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h1
              className="text-xl sm:text-2xl font-bold text-foreground truncate"
              title={name}
            >
              {name || "未命名频道"}
            </h1>
            <div className="flex items-center gap-2">
              {category && <Badge variant="secondary">{category}</Badge>}
              <span className="text-xs text-muted-foreground">直播</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              原始直播源地址
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="flex-1 min-w-0 font-mono text-xs text-muted-foreground break-all">
              {url}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyRawUrl}
              className="h-8 gap-1 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Clipboard className="h-4 w-4" />
              复制
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
