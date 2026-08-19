import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";

export interface AiSubtitleHeaderProps {
  title: string;
  onBack: () => void;
}

export function AiSubtitleHeader({ title, onBack }: AiSubtitleHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          返回播放器
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI 字幕翻译
        </h1>
        <p className="text-sm text-muted-foreground">
          选择原始字幕轨道，使用配置好的 AI
          大模型进行高质量翻译，并可在此管理、下载或清理已生成的翻译字幕。
        </p>
      </div>
    </>
  );
}
