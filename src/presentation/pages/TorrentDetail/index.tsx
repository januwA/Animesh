import { useSearchParams } from "react-router-dom";
import { z } from "zod";
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

  const parsed = torrentDetailParamsSchema.safeParse({
    magnet: searchParams.get("magnet") ?? undefined,
    infoHash: searchParams.get("infoHash") ?? undefined,
  });
  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的种子详情参数" error={parsed.error} />
    );
  }

  return <TorrentDetailView {...parsed.data} />;
}

function TorrentDetailView({ magnet, infoHash }: TorrentDetailParams) {
  const {
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
  } = useTorrentDetailPage({ magnet, infoHash });

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <TorrentDetailContent
        torrent={torrent}
        loading={loading}
        error={error}
        selectedIds={selectedIds}
        initialized={initialized}
        confirming={confirming}
        onRetry={refetch}
        onPlay={handleStartPlayback}
        onToggleFile={toggleFile}
        onToggleAll={toggleAll}
        onConfirmSelection={confirmSelection}
      />
    </div>
  );
}
