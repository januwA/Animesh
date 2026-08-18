import { ArrowLeft, FileVideo, Film, Loader2, Play } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { ErrorState } from "@/presentation/components/ErrorState";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatBytes } from "@/utils";
import { InvalidParamsView } from "../components/InvalidParamsView";

const torrentDetailParamsSchema = z
  .object({
    magnet: NonEmptyStringSchema.optional(),
    title: NonEmptyStringSchema,
    infoHash: NonEmptyStringSchema.optional(),
  })
  .refine((p) => !p.magnet && !p.infoHash, {
    message: "未提供有效的磁力链接或种子 Hash",
    path: ["source"],
  });

type TorrentDetailParams = z.infer<typeof torrentDetailParamsSchema>;

export default function TorrentDetail() {
  const [searchParams] = useSearchParams();

  const parsed = torrentDetailParamsSchema.safeParse({
    magnet: searchParams.get("magnet") ?? undefined, // 从搜索页面进入这里只有 magnet力链接
    title: searchParams.get("title"), // 通常是发布者给 torrent 设置的标题
    infoHash: searchParams.get("infoHash") ?? undefined, // 本地下载种子后就可以直接用hash获取信息
  });
  // v8 ignore start
  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的种子详情参数" error={parsed.error} />
    );
  }
  // v8 ignore stop

  return <TorrentDetailView {...parsed.data} />;
}

function TorrentDetailView({ magnet, title, infoHash }: TorrentDetailParams) {
  const navigate = useNavigate();

  const { resolveTorrentUseCase } = useDI();

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

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="gap-2 text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      {loading ? (
        <Card className="py-20">
          <CardContent
            className="flex flex-col items-center justify-center text-center gap-4"
            role="dialog"
          >
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-2" />
            <h2 className="text-xl font-bold">正在启动下载引擎并解析种子...</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              首次连接 Peer 并下载 Metadata 可能需要较长时间，请稍等
            </p>
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState title="种子解析失败" message={error} onRetry={refetch} />
      ) : !torrent ? (
        <Empty className="py-20">
          <EmptyContent>
            <EmptyTitle>未找到种子数据</EmptyTitle>
            <EmptyDescription>解析未返回结果，请重试或返回</EmptyDescription>
          </EmptyContent>
          <Button variant="outline" onClick={refetch}>
            重试
          </Button>
        </Empty>
      ) : (
        <Card className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
          {/* Header info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1 flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold break-all text-foreground">
                {torrent.name}
              </h2>
              <p className="text-xs text-muted-foreground font-mono break-all">
                Hash: {torrent.info_hash}
              </p>
            </div>
          </div>

          {/* File List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Film className="h-4 w-4 text-primary" />
                选择要播放的文件：
              </h3>
              <Badge variant="secondary" className="text-xs">
                共 {torrent.files.length} 个文件
              </Badge>
            </div>
            <div className="border border-border rounded-lg bg-muted/30 p-3 flex flex-col gap-2">
              {torrent.files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg hover:bg-accent border border-transparent hover:border-border transition-all group gap-3"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileVideo className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-medium text-foreground break-all"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatBytes(file.len)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      handleStartPlayback(torrent.info_hash, file.id, file.name)
                    }
                    className="gap-1.5 h-8 shrink-0 w-full sm:w-auto"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    播放
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
