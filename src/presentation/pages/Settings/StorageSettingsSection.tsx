import { Folder, Gauge, HardDrive, Info, Lightbulb } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";

export interface StorageSettingsSectionProps {
  downloadDir: string;
  isMobile: boolean;
  maxDownloadSpeed: number;
  maxUploadSpeed: number;
  onDownloadDirChange: (value: string) => void;
  onMaxDownloadSpeedChange: (value: number) => void;
  onMaxUploadSpeedChange: (value: number) => void;
  onSelectDir: () => void;
}

export function StorageSettingsSection({
  downloadDir,
  isMobile,
  maxDownloadSpeed,
  maxUploadSpeed,
  onDownloadDirChange,
  onMaxDownloadSpeedChange,
  onMaxUploadSpeedChange,
  onSelectDir,
}: StorageSettingsSectionProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <HardDrive className="h-4 w-4 text-primary" />
          存储设置 (BT 下载及缓存目录)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="download-dir-input"
            className="text-muted-foreground font-medium"
          >
            默认下载及播放缓存目录
          </label>
          <div className="flex gap-2">
            <Input
              id="download-dir-input"
              value={downloadDir}
              disabled={isMobile}
              onChange={(e) => onDownloadDirChange(e.target.value)}
              placeholder={
                isMobile
                  ? "应用沙盒内部路径"
                  : "选择或输入下载路径，例如 D:\\AnimeshDownloads"
              }
              className="flex-1 bg-secondary/30 border-border text-foreground py-5 text-xs disabled:opacity-80"
            />
            {!isMobile && (
              <Button
                type="button"
                variant="secondary"
                onClick={onSelectDir}
                className="gap-1.5 h-10.5 font-medium px-4 text-xs"
              >
                <Folder className="h-4 w-4" />
                选择目录
              </Button>
            )}
          </div>
          <p className="text-muted-foreground/70 leading-relaxed mt-1 flex flex-col gap-1.5">
            {isMobile ? (
              <span className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                移动端（Android/iOS）已自动选用应用沙盒内部路径，无需且不支持手动更改。
              </span>
            ) : (
              <span className="flex items-start gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>
                  提示：边下边播的缓存与下载的完整文件均保存在该路径下。建议选择剩余空间较大的磁盘分区（非系统C盘），以防空间不足导致播放异常。
                </span>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-border">
          <label
            htmlFor="max-download-speed-input"
            className="text-muted-foreground font-medium flex items-center gap-1.5"
          >
            <Gauge className="h-3.5 w-3.5 text-primary" />
            后台下载速度限制
          </label>
          <div className="flex gap-2 items-center">
            <Input
              id="max-download-speed-input"
              type="number"
              min={0}
              value={maxDownloadSpeed}
              onChange={(e) => onMaxDownloadSpeedChange(Number(e.target.value))}
              placeholder="0"
              className="sm:w-28"
            />
            <span className="text-xs text-muted-foreground font-medium">
              KB/s
            </span>
          </div>
          <p className="text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>限制 BT 后台下载的速率。设为 0 表示不限速。</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-border">
          <label
            htmlFor="max-upload-speed-input"
            className="text-muted-foreground font-medium flex items-center gap-1.5"
          >
            <Gauge className="h-3.5 w-3.5 text-primary" />
            后台上传速度限制
          </label>
          <div className="flex gap-2 items-center">
            <Input
              id="max-upload-speed-input"
              type="number"
              min={0}
              value={maxUploadSpeed}
              onChange={(e) => onMaxUploadSpeedChange(Number(e.target.value))}
              placeholder="0"
              className="sm:w-28"
            />
            <span className="text-xs text-muted-foreground font-medium">
              KB/s
            </span>
          </div>
          <p className="text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>限制 BT 后台做种上传的速率。设为 0 表示不限速。</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
