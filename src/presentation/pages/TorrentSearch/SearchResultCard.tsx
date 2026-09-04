import { ChevronDown, Clock, Globe, Magnet, Play } from "lucide-react";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { TranslatableText } from "@/presentation/components/TranslatableText";
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
import { formatLocalDate } from "@/utils";

interface SearchResultCardProps {
  item: SearchResultItem;
  index: number;
  onCopyMagnet: (magnet: string) => void;
  onPlay: (magnet: string) => void;
}

export function SearchResultCard({
  item,
  index,
  onCopyMagnet,
  onPlay,
}: SearchResultCardProps) {
  return (
    <Card id={`torrent-item-${index}`} className="ani-card">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-semibold leading-relaxed group-hover:text-primary transition-colors">
          {item.title}
        </CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatLocalDate(item.pub_date)}</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0 flex flex-col gap-3">
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
              <TranslatableText
                text={item.description}
                renderHtml
                as="div"
                className="mt-2 text-xs text-muted-foreground leading-relaxed wrap-break-word"
                toolbarClassName="mt-2"
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
