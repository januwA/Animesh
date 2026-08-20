import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import type { ResolveTorrentUseCase } from "@/application/torrent/ResolveTorrentUseCase";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { BackButton } from "@/presentation/components/BackButton";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { TorrentDetailContent } from "./TorrentDetailContent";
import { useTorrentDetailPage } from "./useTorrentDetailPage";

// v8 ignore start
const torrentDetailParamsSchema = z
  .object({
    magnet: NonEmptyStringSchema.optional(),
    title: NonEmptyStringSchema,
    infoHash: NonEmptyStringSchema.optional(),
  })
  .refine((p) => !p.magnet || !p.infoHash, {
    message: "未提供有效的磁力链接或种子 Hash",
    path: ["source"],
  });
type TorrentDetailParams = z.infer<typeof torrentDetailParamsSchema>;
// v8 ignore stop

export default function TorrentDetail() {
  const [searchParams] = useSearchParams();
  const { resolveTorrentUseCase } = useDI();

  const parsed = torrentDetailParamsSchema.safeParse({
    magnet: searchParams.get("magnet") ?? undefined,
    title: searchParams.get("title"),
    infoHash: searchParams.get("infoHash") ?? undefined,
  });
  // v8 ignore start
  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的种子详情参数" error={parsed.error} />
    );
  }
  // v8 ignore stop

  return (
    <TorrentDetailView
      {...parsed.data}
      resolveTorrentUseCase={resolveTorrentUseCase}
    />
  );
}

function TorrentDetailView({
  magnet,
  title,
  infoHash,
  resolveTorrentUseCase,
}: TorrentDetailParams & { resolveTorrentUseCase: ResolveTorrentUseCase }) {
  const { torrent, loading, error, refetch, handleStartPlayback } =
    useTorrentDetailPage(
      { magnet, infoHash, title },
      { resolveTorrentUseCase },
    );

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <BackButton />

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
