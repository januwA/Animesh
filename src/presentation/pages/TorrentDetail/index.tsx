import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import type { ResolveTorrentUseCase } from "@/application/torrent/ResolveTorrentUseCase";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { TorrentDetailContent } from "./TorrentDetailContent";
import { useTorrentDetailPage } from "./useTorrentDetailPage";

const torrentDetailParamsSchema = z
  .object({
    magnet: NonEmptyStringSchema.optional(),
    infoHash: NonEmptyStringSchema.optional(),
  })
  .refine((p) => !p.magnet || !p.infoHash, {
    message: "未提供有效的磁力链接或种子 Hash",
    path: ["source"],
  });
type TorrentDetailParams = z.infer<typeof torrentDetailParamsSchema>;

export default function TorrentDetail() {
  const [searchParams] = useSearchParams();
  const { resolveTorrentUseCase } = useDI();

  const parsed = torrentDetailParamsSchema.safeParse({
    magnet: searchParams.get("magnet") ?? undefined,
    infoHash: searchParams.get("infoHash") ?? undefined,
  });
  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的种子详情参数" error={parsed.error} />
    );
  }

  return (
    <TorrentDetailView
      {...parsed.data}
      resolveTorrentUseCase={resolveTorrentUseCase}
    />
  );
}

function TorrentDetailView({
  magnet,
  infoHash,
  resolveTorrentUseCase,
}: TorrentDetailParams & { resolveTorrentUseCase: ResolveTorrentUseCase }) {
  const { torrent, loading, error, refetch, handleStartPlayback } =
    useTorrentDetailPage({ magnet, infoHash }, { resolveTorrentUseCase });

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <TorrentDetailContent
        torrent={torrent}
        loading={loading}
        error={error}
        onRetry={refetch}
        onPlay={handleStartPlayback}
      />
    </div>
  );
}
