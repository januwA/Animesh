import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { TorrentDetailContent } from "./TorrentDetailContent";

const torrentDetailParamsSchema = z
  .object({
    magnet: NonEmptyStringSchema.optional(),
    infoHash: NonEmptyStringSchema.optional(),
  })
  .refine((p) => !!p.magnet !== !!p.infoHash, {
    message: "请提供磁力链接或种子 Hash（二选一）",
    path: ["source"],
  });

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

  return <TorrentDetailContent {...parsed.data} />;
}
