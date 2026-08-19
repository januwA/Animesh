import { Loader2 } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";

interface SearchLoadingProps {
  onCancel: () => void;
}

export function SearchLoading({ onCancel }: SearchLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground font-medium">
        正在获取资源列表...
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        className="text-xs text-muted-foreground hover:text-foreground mt-2"
      >
        取消搜索
      </Button>
    </div>
  );
}
