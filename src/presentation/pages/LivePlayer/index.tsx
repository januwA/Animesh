import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { LivePlayerView } from "./LivePlayerView";

const livePlayerParamsSchema = z.object({
  url: z.string().trim().min(1, "缺少直播流地址参数"),
  name: z.string().default(""),
  logo: z.string().default(""),
  category: z.string().default(""),
});

export default function LivePlayer() {
  const [searchParams] = useSearchParams();
  const { resolvePlayableStreamUrlUseCase, logger } = useDI();

  const parsed = livePlayerParamsSchema.safeParse({
    url: searchParams.get("url") ?? "",
    name: searchParams.get("name") ?? undefined,
    logo: searchParams.get("logo") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });
  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的直播播放参数" error={parsed.error} />
    );
  }

  return (
    <LivePlayerView
      {...parsed.data}
      deps={{ resolvePlayableStreamUrlUseCase, logger }}
    />
  );
}
