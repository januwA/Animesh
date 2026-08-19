import { ExternalLink, Play, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";

export function WelcomeGuide() {
  return (
    <div className="mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-muted-foreground/75">
      <Card className="bg-card/25 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            聚合搜索
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          一键检索动漫花园资源列表，快速检索并汇总磁力资源。
        </CardContent>
      </Card>
      <Card className="bg-card/25 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-primary fill-current" />
            边下边播
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          内置高性能 BT 流媒体播放引擎，无须等待下载完毕，边下边放。
        </CardContent>
      </Card>
      <Card className="bg-card/25 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" />
            外部播放
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          支持一键拷贝本地视频流 URL，可在 VLC 或 PotPlayer 中播放。
        </CardContent>
      </Card>
    </div>
  );
}
