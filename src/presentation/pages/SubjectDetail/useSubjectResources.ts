import { useMemo } from "react";
import { toast } from "sonner";
import type { ClearTorrentSubjectUseCase } from "@/application/torrent/ClearTorrentSubjectUseCase";
import type { SetTorrentSubjectUseCase } from "@/application/torrent/SetTorrentSubjectUseCase";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { formatError } from "@/utils";

export interface UseSubjectResourcesParams {
  subjectId: number;
  platform: AnimePlatform;
  torrents: TorrentStatusInfo[];
  subjectName: string;
}

/** useSubjectResources 的依赖，由调用方（页面组合根）注入 */
export interface UseSubjectResourcesDeps {
  setTorrentSubjectUseCase: Pick<SetTorrentSubjectUseCase, "execute">;
  clearTorrentSubjectUseCase: Pick<ClearTorrentSubjectUseCase, "execute">;
}

export interface SubjectResourcesResult {
  boundResourcesCount: number;
  boundTorrents: TorrentStatusInfo[];
  unboundTorrents: TorrentStatusInfo[];
  bindLoading: boolean;
  unbindLoading: boolean;
  handleBind: (infoHash: string) => void;
  handleUnbind: (infoHash: NonEmptyString) => void;
}

export function useSubjectResources(
  params: UseSubjectResourcesParams,
  deps: UseSubjectResourcesDeps,
): SubjectResourcesResult {
  const { subjectId, platform, torrents, subjectName } = params;
  const { setTorrentSubjectUseCase, clearTorrentSubjectUseCase } = deps;

  const boundResourcesCount = useMemo(
    () => torrents.filter((t) => t.subject_id === subjectId).length,
    [torrents, subjectId],
  );

  const boundTorrents = useMemo(
    () => torrents.filter((t) => t.subject_id === subjectId),
    [torrents, subjectId],
  );

  const unboundTorrents = useMemo(
    () => torrents.filter((t) => !t.subject_id),
    [torrents],
  );

  const bindMutation = useMutation(
    (_ctx, p: { infoHash: string }) =>
      setTorrentSubjectUseCase.execute({
        infoHash: NonEmptyStringSchema.parse(p.infoHash),
        subjectId,
        platform,
        subjectName: NonEmptyStringSchema.parse(subjectName),
      }),
    {
      onSuccess: () => toast.success("已绑定下载资源"),
      onError: (err) => toast.error(`绑定失败: ${formatError(err)}`),
    },
  );
  const handleBind = (infoHash: string) => bindMutation.execute({ infoHash });

  const unbindMutation = useMutation(
    (_ctx, p: { infoHash: NonEmptyString }) =>
      clearTorrentSubjectUseCase.execute(p.infoHash, platform),
    {
      onSuccess: () => toast.success("已解除绑定"),
      onError: (err) => toast.error(`解绑失败: ${formatError(err)}`),
    },
  );
  const handleUnbind = (infoHash: NonEmptyString) =>
    unbindMutation.execute({ infoHash });

  return {
    boundResourcesCount,
    boundTorrents,
    unboundTorrents,
    bindLoading: bindMutation.loading,
    unbindLoading: unbindMutation.loading,
    handleBind,
    handleUnbind,
  };
}
