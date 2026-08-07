import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/presentation/components/ui/pagination";

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) {
    items.push("ellipsis-start");
  }
  for (let page = start; page <= end; page++) {
    items.push(page);
  }
  if (end < totalPages - 1) {
    items.push("ellipsis-end");
  }
  items.push(totalPages);
  return items;
}

function clampPage(value: number, totalPages: number): number {
  return Math.min(Math.max(1, Math.floor(value)), totalPages);
}

interface EpisodePaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onJumpToEpisode: (episode: number) => void;
}

export function EpisodePaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
  onJumpToEpisode,
}: EpisodePaginationBarProps) {
  const [pageInput, setPageInput] = useState("");
  const [episodeInput, setEpisodeInput] = useState("");

  const submitPage = () => {
    const value = Number.parseInt(pageInput, 10);
    if (Number.isNaN(value)) return;
    onPageChange(clampPage(value, totalPages));
    setPageInput("");
  };

  const submitEpisode = () => {
    const value = Number.parseInt(episodeInput, 10);
    if (Number.isNaN(value) || value < 1) return;
    onJumpToEpisode(value);
    setEpisodeInput("");
  };

  const items = getPageItems(page, totalPages);

  return (
    <div className="flex flex-col items-center gap-3">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="gap-1"
            >
              <ChevronLeft data-icon="inline-start" />
              上一页
            </Button>
          </PaginationItem>
          {items.map((item) =>
            item === "ellipsis-start" || item === "ellipsis-end" ? (
              <PaginationItem key={item}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <Button
                  variant={item === page ? "outline" : "ghost"}
                  size="icon"
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="gap-1"
            >
              下一页
              <ChevronRight data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>
          共 {total} 集 · 第 {page} / {totalPages} 页
        </span>
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap">跳转页</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPage();
            }}
            placeholder={`${totalPages}`}
            aria-label="跳转页码"
            className="h-7 w-16"
          />
          <Button variant="secondary" size="xs" onClick={submitPage}>
            前往
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap">跳转集</span>
          <Input
            type="number"
            min={1}
            max={total}
            value={episodeInput}
            onChange={(e) => setEpisodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitEpisode();
            }}
            placeholder={`${total}`}
            aria-label="跳转集数"
            className="h-7 w-16"
          />
          <Button variant="secondary" size="xs" onClick={submitEpisode}>
            前往
          </Button>
        </div>
      </div>
    </div>
  );
}
