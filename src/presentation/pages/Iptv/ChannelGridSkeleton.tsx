import { Skeleton } from "@/presentation/components/ui/skeleton";

export function ChannelGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      data-testid="channel-grid-skeleton"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <div
          key={n}
          className="flex flex-col bg-card border border-border rounded-lg overflow-hidden"
        >
          <Skeleton className="aspect-square rounded-none" />
          <div className="p-2 flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
