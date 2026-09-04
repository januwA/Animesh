import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { FileDetails } from "@/domain/torrent/TorrentSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";

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

  const initialized = useMemo(() => {
    if (torrent) {
      const ids = new Set(
        torrent.files.filter((f) => f.included).map((f) => f.id),
      );
      setSelectedIds(ids);
      return true;
    }
    return false;
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
      const allSelected = files.every((f) => prev.has(f.id));
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
        torrent.info_hash as NonEmptyString,
        Array.from(selectedIds),
      );
      await refetch();
    } finally {
      setConfirming(false);
    }
  }, [torrent, selectedIds, updateOnlyFilesUseCase, refetch]);

  const handleStartPlayback = (
    info_hash: string,
    fileId: number,
    fileName: string,
  ) => {
    navigate(
      `/play/${info_hash}/${fileId}?&fileName=${encodeURIComponent(fileName)}`,
      {
        replace: true,
      },
    );
  };

  return {
    torrent,
    loading,
    error,
    refetch,
    selectedIds,
    initialized,
    confirming,
    toggleFile,
    toggleAll,
    confirmSelection,
    handleStartPlayback,
  };
}
