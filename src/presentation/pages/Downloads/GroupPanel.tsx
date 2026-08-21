import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { Badge } from "@/presentation/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/presentation/components/ui/collapsible";

export interface GroupPanelProps {
  title: string;
  items: TorrentStatusInfo[];
  defaultOpen: boolean;
  action?: ReactNode;
  children: ReactNode;
}

/** 分组面板：可折叠头部 + 聚合进度/操作条 + 任务卡片网格，自适应 PC 与手机。 */
export function GroupPanel({
  title,
  items,
  defaultOpen,
  action,
  children,
}: GroupPanelProps) {
  const total = items.length;

  return (
    <Collapsible defaultOpen={defaultOpen} className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border ani-card">
        <div className="flex items-center gap-2 px-4 py-3.5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg py-1 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                {title}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{total}</Badge>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </span>
            </button>
          </CollapsibleTrigger>
          {action}
        </div>
      </div>

      <CollapsibleContent className="grid gap-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
