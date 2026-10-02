import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface InfiniteScrollTriggerProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export function InfiniteScrollTrigger({
  hasMore,
  loading,
  onLoadMore,
}: InfiniteScrollTriggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ hasMore, loading, onLoadMore });
  stateRef.current = { hasMore, loading, onLoadMore };
  const lastLoadTimeRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    const el = ref.current;
    if (!el || !hasMore) return;
    // v8 ignore start
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const state = stateRef.current;
        if (!state.hasMore || state.loading) return;
        const now = Date.now();
        if (now - lastLoadTimeRef.current < 300) return;
        lastLoadTimeRef.current = now;
        state.onLoadMore();
      },
      { rootMargin: "200px" },
    );
    // v8 ignore end
    observerRef.current = observer;
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div
      ref={ref}
      data-testid="infinite-scroll-trigger"
      className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载更多...
        </>
      ) : hasMore ? (
        "上滑加载更多"
      ) : (
        "没有更多了"
      )}
    </div>
  );
}
