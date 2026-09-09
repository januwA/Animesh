import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type {
  AddTorrentResult,
  FileDetails,
  TorrentStatusInfo,
} from "@/domain/torrent/TorrentSchemas";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";

interface UseTorrentDetailPageParams {
  magnet?: NonEmptyString;
  infoHash?: NonEmptyString;
}

/** 从种子文件中提取后端已持久化的选择集（included=true） */
function confirmedIds(torrent: AddTorrentResult): Set<number> {
  return new Set(torrent.files.filter((f) => f.included).map((f) => f.id));
}

/** 判断面板选择集是否与后端已持久化的选择集不一致（存在未保存的变更） */
function isSelectionDirty(
  selected: Set<number>,
  torrent: AddTorrentResult,
): boolean {
  const confirmed = confirmedIds(torrent);
  return (
    selected.size !== confirmed.size ||
    Array.from(selected).some((id) => !confirmed.has(id))
  );
}

export function useTorrentDetailPage(params: UseTorrentDetailPageParams) {
  const { resolveTorrentUseCase, updateOnlyFilesUseCase } = useDI();
  const { magnet, infoHash } = params;
  const navigate = useNavigate();
  // 全局实时状态流：用于展示当前种子的下载进度 / 速度
  const { torrents } = useTorrentStatus();

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

  // magnet 场景初始 infoHash 未知，用解析后的 torrent.info_hash 兜底匹配
  const currentHash = torrent?.info_hash ?? infoHash;
  const status: TorrentStatusInfo | null = useMemo(
    () =>
      currentHash
        ? (torrents.find((t) => t.info_hash === currentHash) ?? null)
        : null,
    [torrents, currentHash],
  );
  const downloadProgress =
    status && status.total_bytes > 0
      ? (status.progress_bytes / status.total_bytes) * 100
      : 0;

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

  // 单一保存职责：持久化指定选择集，返回是否成功（供确认按钮与播放前共用）
  const saveSelection = useCallback(
    async (targetHash: NonEmptyString, ids: Set<number>): Promise<boolean> => {
      setConfirming(true);
      try {
        await updateOnlyFilesUseCase.execute(targetHash, Array.from(ids));
        toast.success("文件选择已更新");
        await refetch();
        return true;
      } catch (err) {
        toast.error(`更新文件选择失败: ${formatError(err)}`);
        return false;
      } finally {
        setConfirming(false);
      }
    },
    [updateOnlyFilesUseCase, refetch],
  );

  const confirmSelection = useCallback(async () => {
    if (!torrent) return;
    await saveSelection(torrent.info_hash, selectedIds);
  }, [torrent, selectedIds, saveSelection]);

  const handleStartPlayback = useCallback(
    async (infoHash: string, fileId: number, fileName: string) => {
      // 若面板存在未确认的勾选，先持久化再跳转；失败则中止，避免播放失效。
      if (torrent && isSelectionDirty(selectedIds, torrent)) {
        const ok = await saveSelection(torrent.info_hash, selectedIds);
        if (!ok) return;
      }
      const query = new URLSearchParams({ fileName });
      navigate(`/play/${infoHash}/${fileId}?${query.toString()}`);
    },
    [torrent, selectedIds, saveSelection, navigate],
  );

  return {
    torrent,
    loading,
    error,
    refetch,
    selectedIds,
    confirming,
    status,
    downloadProgress,
    toggleFile,
    toggleAll,
    confirmSelection,
    handleStartPlayback,
  };
}
