import { Loader2 } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";

interface AiSearchLoadingProps {
  onCancel: () => void;
}

export function AiSearchLoading({ onCancel }: AiSearchLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
        <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-xl animate-pulse" />{" "}
        {/* style-ignore */}
      </div>
      <p className="text-sm font-semibold bg-linear-to-r from-cyan-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent animate-pulse">
        AI 正在搜索，可能需要数秒，请稍候...
      </p>
      <p className="text-xs text-muted-foreground max-w-xs text-center leading-relaxed">
        正在分析意图，并根据需要在不同搜索引擎间自动检索 Fallback...
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        className="text-xs text-muted-foreground hover:text-foreground mt-2 border-border bg-secondary/50"
      >
        取消搜索
      </Button>
    </div>
  );
}
