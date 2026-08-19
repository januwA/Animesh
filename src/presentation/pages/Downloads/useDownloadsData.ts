import type { Context } from "ajanuw-context";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { DeleteTorrentUseCase } from "@/application/torrent/DeleteTorrentUseCase";
import type { PauseTorrentUseCase } from "@/application/torrent/PauseTorrentUseCase";
import type { ResumeTorrentUseCase } from "@/application/torrent/ResumeTorrentUseCase";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { formatError } from "@/utils";

export interface SubjectGroup {
  subjectId: number;
  subjectName: string;
  items: TorrentStatusInfo[];
}

/** 按 subject_id 分组，未绑定的归入 unbound 数组，各组内按创建时间倒序。 */
export function groupTorrents(torrents: TorrentStatusInfo[]): {
  groups: SubjectGroup[];
  unbound: TorrentStatusInfo[];
} {
  const sorted = [...torrents].sort(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0),
  );
  const groupMap = new Map<number, SubjectGroup>();
  const unbound: TorrentStatusInfo[] = [];

  for (const torrent of sorted) {
    if (torrent.subject_id != null && torrent.subject_name) {
      const subjectId = torrent.subject_id;
      const group = groupMap.get(subjectId) ?? {
        subjectId,
        subjectName: torrent.subject_name,
        items: [],
      };
      group.items.push(torrent);
      groupMap.set(subjectId, group);
    } else {
      unbound.push(torrent);
    }
  }

  return { groups: [...groupMap.values()], unbound };
}

export interface UseDownloadsDataParams {
  torrents: TorrentStatusInfo[];
}

export interface UseDownloadsDataDeps {
  pauseTorrentUseCase: Pick<PauseTorrentUseCase, "execute">;
  resumeTorrentUseCase: Pick<ResumeTorrentUseCase, "execute">;
  deleteTorrentUseCase: Pick<DeleteTorrentUseCase, "execute">;
}

export interface UseDownloadsDataResult {
  visibleTorrents: TorrentStatusInfo[];
  groups: SubjectGroup[];
  unbound: TorrentStatusInfo[];
  delLoading: boolean;
  pendingPauseHash: string | null;
  pendingResumeHash: string | null;
  pendingDeleteHash: string | null;
  handleViewFiles: (torrent: TorrentStatusInfo) => void;
  handleTogglePause: (torrent: TorrentStatusInfo) => void;
  handleDelete: (torrent: TorrentStatusInfo, deleteFiles: boolean) => void;
}

interface TorrentActionParams {
  infoHash: NonEmptyString;
  name: NonEmptyString;
}

export function useDownloadsData(
  params: UseDownloadsDataParams,
  deps: UseDownloadsDataDeps,
): UseDownloadsDataResult {
  const navigate = useNavigate();
  const { torrents } = params;
  const { pauseTorrentUseCase, resumeTorrentUseCase, deleteTorrentUseCase } =
    deps;

  // Per-card pending state：避免全局 loading 串扰禁用其他卡片
  const [pendingPauseHash, setPendingPauseHash] = useState<string | null>(null);
  const [pendingResumeHash, setPendingResumeHash] = useState<string | null>(
    null,
  );
  const [pendingDeleteHash, setPendingDeleteHash] = useState<string | null>(
    null,
  );
  // 删除乐观更新：成功后立即隐藏卡片，不等下一轮推送
  const [hiddenHashes, setHiddenHashes] = useState<Set<string>>(
    () => new Set(),
  );

  const pauseMutation = useMutation(
    (_ctx: Context, p: TorrentActionParams) =>
      pauseTorrentUseCase.execute(p.infoHash),
    {
      onSuccess: (_data, p) => toast(`已暂停任务: ${p.name}`),
      onError: (err) => toast.error(`暂停失败: ${formatError(err)}`),
      onSettled: () => setPendingPauseHash(null),
    },
  );

  const resumeMutation = useMutation(
    (_ctx: Context, p: TorrentActionParams) =>
      resumeTorrentUseCase.execute(p.infoHash),
    {
      onSuccess: (_data, p) => toast.success(`已开始下载任务: ${p.name}`),
      onError: (err) => toast.error(`启动失败: ${formatError(err)}`),
      onSettled: () => setPendingResumeHash(null),
    },
  );

  const delMutation = useMutation(
    (_ctx: Context, p: { target: TorrentStatusInfo; deleteFiles: boolean }) =>
      deleteTorrentUseCase.execute(p.target.info_hash, p.deleteFiles),
    {
      onSuccess: (_data, p) => {
        toast.success("已删除任务");
        setHiddenHashes((prev) => {
          const next = new Set(prev);
          next.add(p.target.info_hash);
          return next;
        });
      },
      onError: (err) => toast.error(`删除任务失败: ${formatError(err)}`),
      onSettled: () => setPendingDeleteHash(null),
    },
  );

  // 过滤掉已乐观删除的卡片
  const visibleTorrents = useMemo(
    () => torrents.filter((t) => !hiddenHashes.has(t.info_hash)),
    [torrents, hiddenHashes],
  );

  const { groups, unbound } = useMemo(
    () => groupTorrents(visibleTorrents),
    [visibleTorrents],
  );

  const handleViewFiles = (torrent: TorrentStatusInfo) => {
    navigate(
      `/torrent?infoHash=${torrent.info_hash}&title=${encodeURIComponent(torrent.name)}`,
    );
  };

  const handleTogglePause = (torrent: TorrentStatusInfo) => {
    if (torrent.paused) {
      setPendingResumeHash(torrent.info_hash);
      resumeMutation.execute({
        infoHash: torrent.info_hash,
        name: torrent.name,
      });
    } else {
      setPendingPauseHash(torrent.info_hash);
      pauseMutation.execute({
        infoHash: torrent.info_hash,
        name: torrent.name,
      });
    }
  };

  const handleDelete = (target: TorrentStatusInfo, deleteFiles: boolean) => {
    setPendingDeleteHash(target.info_hash);
    delMutation.execute({ target, deleteFiles });
  };

  return {
    visibleTorrents,
    groups,
    unbound,
    delLoading: delMutation.loading,
    pendingPauseHash,
    pendingResumeHash,
    pendingDeleteHash,
    handleViewFiles,
    handleTogglePause,
    handleDelete,
  };
}
