import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { FileDetails } from "@/domain/torrent/TorrentSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";

interface UseTorrentDetailPageParams {
  magnet?: NonEmptyString;
  infoHash?: NonEmptyString;
}

export function useTorrentDetailPage(params: UseTorrentDetailPageParams) {
  const { resolveTorrentUseCase, updateOnlyFilesUseCase } = useDI();
  const { magnet, infoHash } = params;
  const navigate = useNavigate();

  const {
    data: torrent,
    loading,
    error,
    refetch,
  } = useQuery(
    (ctx) => resolveTorrentUseCase.execute(ctx, { magnet, infoHash }),
    [magnet, infoHash, resolveTorrentUseCase],
  );

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);

  // 种子数据变化时，用后端返回的 included 状态同步本地选择集
  useEffect(() => {
    if (!torrent) return;
    setSelectedIds(
      new Set(torrent.files.filter((f) => f.included).map((f) => f.id)),
    );
  }, [torrent]);

  const toggleFile = useCallback((fileId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((files: FileDetails[]) => {
    setSelectedIds((prev) => {
      const allSelected =
        files.length > 0 && files.every((f) => prev.has(f.id));
      if (allSelected) {
        return new Set();
      }
      return new Set(files.map((f) => f.id));
    });
  }, []);

  const confirmSelection = useCallback(async () => {
    if (!torrent) return;
    setConfirming(true);
    try {
      await updateOnlyFilesUseCase.execute(
        torrent.info_hash,
        Array.from(selectedIds),
      );
      toast.success("文件选择已更新");
      await refetch();
    } catch (err) {
      toast.error(`更新文件选择失败: ${formatError(err)}`);
    } finally {
      setConfirming(false);
    }
  }, [torrent, selectedIds, updateOnlyFilesUseCase, refetch]);

  const handleStartPlayback = (
    infoHash: string,
    fileId: number,
    fileName: string,
  ) => {
    const query = new URLSearchParams({ fileName });
    navigate(`/play/${infoHash}/${fileId}?${query.toString()}`);
  };

  return {
    torrent,
    loading,
    error,
    refetch,
    selectedIds,
    confirming,
    toggleFile,
    toggleAll,
    confirmSelection,
    handleStartPlayback,
  };
}
