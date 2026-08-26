import { Download } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";

export interface DownloadsHeaderProps {
  total: number;
}

/** 下载管理页头部：标题 + 全部任务数量徽标。 */
export function DownloadsHeader({ total }: DownloadsHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-4">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          下载管理
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          管理所有在后台进行的种子下载与边下边播任务
        </p>
      </div>
      <Badge variant="secondary" className="px-2.5 py-1">
        全部任务: {total}
      </Badge>
    </div>
  );
}
