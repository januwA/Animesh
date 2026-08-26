import { createContext, use } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { useStream } from "@/presentation/hooks/useStream";
import { formatError } from "@/utils";

interface TorrentStatusContextType {
  torrents: TorrentStatusInfo[];
  isLoading: boolean;
}

const TorrentStatusContext = createContext<
  TorrentStatusContextType | undefined
>(undefined);

export function TorrentStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { subscribeTorrentsUseCase } = useDI();

  const { data: torrents, status } = useStream(
    (_ctx) => subscribeTorrentsUseCase.execute(),
    [subscribeTorrentsUseCase],
    {
      onError: (err) => {
        toast.error(`获取下载列表失败: ${formatError(err)}`);
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
