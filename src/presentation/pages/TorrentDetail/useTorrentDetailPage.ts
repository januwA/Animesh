import { useNavigate } from "react-router-dom";
import type { ResolveTorrentUseCase } from "@/application/torrent/ResolveTorrentUseCase";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface UseTorrentDetailPageDeps {
  resolveTorrentUseCase: Pick<ResolveTorrentUseCase, "execute">;
}

interface UseTorrentDetailPageParams {
  magnet?: NonEmptyString;
  infoHash?: NonEmptyString;
  title: NonEmptyString;
}

export function useTorrentDetailPage(
  params: UseTorrentDetailPageParams,
  deps: UseTorrentDetailPageDeps,
) {
  const { resolveTorrentUseCase } = deps;
  const { magnet, infoHash, title } = params;
  const navigate = useNavigate();

  const {
    data: torrent,
    loading,
    error,
    refetch,
  } = useQuery(
    (ctx) => resolveTorrentUseCase.execute(ctx, { magnet, infoHash, title }),
    [magnet, infoHash, title, resolveTorrentUseCase],
  );

  const handleBack = () => {
    navigate(-1);
  };

  const handleStartPlayback = (
    info_hash: string,
    fileId: number,
    fileName: string,
  ) => {
    navigate(
      `/play/${info_hash}/${fileId}?title=${encodeURIComponent(
        title,
      )}&fileName=${encodeURIComponent(fileName)}`,
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
    handleBack,
    handleStartPlayback,
  };
}
