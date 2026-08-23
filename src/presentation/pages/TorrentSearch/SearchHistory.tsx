import { X } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";

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
    <Card className="ani-card">
      <CardHeader>
        <CardTitle className="text-sm">最近搜索</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={onClear}
          >
            清空
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {history.map((item) => (
          <Badge
            key={item}
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1 px-2.5 py-0.5 text-xs"
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
      </CardContent>
    </Card>
  );
}
