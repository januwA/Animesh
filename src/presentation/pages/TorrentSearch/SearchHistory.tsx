import { Clock, X } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";

interface SearchHistoryProps {
  history: string[];
  onSelectKeyword: (keyword: string) => void;
  onDelete: (item: string) => void;
  onClear: () => void;
}

export function SearchHistory({
  history,
  onSelectKeyword,
  onDelete,
  onClear,
}: SearchHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="mx-auto w-full mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
      <span className="flex items-center gap-1 font-medium">
        <Clock className="h-3.5 w-3.5" />
        最近搜索:
      </span>
      {history.map((item) => (
        <Badge
          key={item}
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1 px-2.5 py-0.5"
          onClick={() => onSelectKeyword(item)}
        >
          {item}
          <button
            type="button"
            data-testid={`delete-history-${item}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            className="text-muted-foreground hover:text-foreground rounded-full p-0.5 hover:bg-accent transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[10px] ml-auto text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={onClear}
      >
        清空
      </Button>
    </div>
  );
}
