import { Loader2 } from "lucide-react";
import { Skeleton } from "@/presentation/components/ui/skeleton";

interface SubjectSearchLoadingProps {
  loadingText?: string;
}

export function SubjectSearchLoading({
  loadingText = "正在搜索条目...",
}: SubjectSearchLoadingProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="subject-search-loading">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <div
            key={n}
            className="flex flex-col bg-card border border-border rounded-lg overflow-hidden"
          >
            <Skeleton className="aspect-3/4 rounded-none" />
            <div className="p-2 flex flex-col gap-2 flex-1">
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3 w-3/6" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {loadingText}
      </div>
    </div>
  );
}
