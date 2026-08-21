import {
  Bot,
  ChevronDown,
  Clock,
  Globe,
  Magnet,
  Play,
  Sparkles,
} from "lucide-react";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { Alert, AlertDescription } from "@/presentation/components/ui/alert";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/presentation/components/ui/collapsible";
import { sanitizeHtml } from "@/presentation/lib/sanitizeHtml";
import { cn } from "@/presentation/lib/utils";
import { formatLocalDate } from "@/utils";

interface SearchResultCardProps {
  item: AiSearchResultItem;
  index: number;
  onCopyMagnet: (magnet: string) => void;
  onPlay: (magnet: string) => void;
  isBestAi?: boolean;
}

export function SearchResultCard({
  item,
  index,
  onCopyMagnet,
  onPlay,
  isBestAi = false,
}: SearchResultCardProps) {
  return (
    <Card id={`torrent-item-${index}`} className="ani-card">
      <CardHeader className="p-5 pb-3">
        {item.ai_score !== undefined && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 px-2.5 py-0.5 font-medium",
                isBestAi
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              {isBestAi ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <Bot className="h-3 w-3" />
              )}
              {isBestAi ? "AI 智能精选推荐" : "AI 评分过滤"}
            </Badge>
            <Badge
              variant="outline"
              className={cn("gap-1 px-2.5 py-0.5 font-mono font-semibold")}
            >
              匹配度: {item.ai_score}分
            </Badge>
          </div>
        )}
        <CardTitle className="text-base font-semibold leading-relaxed group-hover:text-primary transition-colors">
          {item.title}
        </CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatLocalDate(item.pub_date)}</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0 flex flex-col gap-3">
        {item.ai_reason && (
          <Alert variant="default" className="text-xs py-3 px-3">
            <AlertDescription className="text-xs font-medium">
              <span className="font-semibold">推荐理由：</span>
              {item.ai_reason}
            </AlertDescription>
          </Alert>
        )}
        {item.description && (
          <Collapsible
            className="group/desc"
            data-testid={`torrent-desc-${index}`}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                data-testid={`torrent-desc-toggle-${index}`}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                描述
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-data-[state=open]/desc:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div
                className="mt-2 text-xs text-muted-foreground leading-relaxed break-words"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: 内容已通过 sanitizeHtml 使用 DOMPurify 净化
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(item.description),
                }}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
      <CardFooter className="px-5 py-3.5 border-t border-border flex items-center justify-between gap-4 bg-muted/30">
        <a
          href={String(item.link)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          title="在浏览器中打开网页"
        >
          <Globe className="h-3.5 w-3.5" />
          网页
        </a>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCopyMagnet(item.magnet)}
            className="h-8 text-xs font-medium gap-1.5"
          >
            <Magnet className="h-3.5 w-3.5" />
            复制磁力
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onPlay(item.magnet)}
            className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            边下边播
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
