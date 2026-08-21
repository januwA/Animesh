import { Info, Loader2, RefreshCw } from "lucide-react";
import type { UpdateCheckResult } from "@/domain/update/UpdateInfo";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";

export interface UpdateCheckSectionProps {
  currentVersion: string;
  checkingUpdate: boolean;
  updateResult: UpdateCheckResult | null;
  onCheckUpdate: () => void;
  onOpenGithub: () => void;
}

export function UpdateCheckSection({
  currentVersion,
  checkingUpdate,
  updateResult,
  onCheckUpdate,
  onOpenGithub,
}: UpdateCheckSectionProps) {
  return (
    <Card className="ani-card">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Info className="h-4 w-4 text-primary" />
          检查更新
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-border bg-secondary/30 rounded-lg p-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">Animesh 客户端</p>
            <p className="text-muted-foreground">
              当前版本：{currentVersion || "加载中..."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={checkingUpdate}
              onClick={onCheckUpdate}
              className="text-xs h-8.5 font-medium border-border bg-secondary/50 text-foreground hover:bg-secondary"
            >
              {checkingUpdate ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              检查更新
            </Button>
          </div>
        </div>

        {updateResult && (
          <div className="border border-border bg-secondary/30 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground">
                {updateResult.hasUpdate ? "发现新版本！" : "当前已是最新版本"}
              </h4>
              {updateResult.hasUpdate && (
                <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                  v{updateResult.latestVersion}
                </span>
              )}
            </div>

            {updateResult.hasUpdate && (
              <>
                <p className="text-muted-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {updateResult.notes}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={onOpenGithub}
                    className="text-xs h-8 font-medium px-3 bg-primary text-primary-foreground"
                  >
                    前往 GitHub 下载
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
