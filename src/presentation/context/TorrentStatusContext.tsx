import { createContext, use } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { useStream } from "@/presentation/hooks/useStream";
import { formatError } from "@/utils";

export interface TorrentStatusContextType {
  torrents: TorrentStatusInfo[];
  isLoading: boolean;
}

export const TorrentStatusContext = createContext<
  TorrentStatusContextType | undefined
>(undefined);

export function TorrentStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { subscribeTorrentsUseCase, notifyDownloadCompletionUseCase } = useDI();

  const { data: torrents, status } = useStream(
    (_ctx) => subscribeTorrentsUseCase.execute(),
    [subscribeTorrentsUseCase],
    {
      onError: (err) => {
        toast.error(`获取下载列表失败: ${formatError(err)}`);
      },
      onData(torrents) {
        notifyDownloadCompletionUseCase.execute(torrents);
      },
    },
  );

  return (
    <TorrentStatusContext
      value={{ torrents: torrents ?? [], isLoading: status === "connecting" }}
    >
      {children}
    </TorrentStatusContext>
  );
}

export function useTorrentStatus(): TorrentStatusContextType {
  const context = use(TorrentStatusContext);
  if (context === undefined) {
    return { torrents: [], isLoading: true };
  }
  return context;
}
