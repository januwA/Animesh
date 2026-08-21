import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";

export interface CacheSettingsSectionProps {
  clearingCache: boolean;
  onClearClick: () => void;
}

export function CacheSettingsSection({
  clearingCache,
  onClearClick,
}: CacheSettingsSectionProps) {
  return (
    <Card className="ani-card">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Trash2 className="h-4 w-4 text-primary" />
          缓存管理
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border bg-secondary/30 rounded-lg p-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">清理缓存数据</p>
            <p className="text-muted-foreground leading-relaxed">
              清理新番日历、条目详情、剧集/角色/制作人员与 IPTV
              等联网缓存数据，清理后相关页面需重新联网加载。收藏数据不会被清除。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={clearingCache}
            onClick={onClearClick}
            className="text-xs h-8.5 font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary shrink-0"
          >
            {clearingCache ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            清理缓存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
