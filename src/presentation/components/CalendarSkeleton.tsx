import { Skeleton } from "@/presentation/components/ui/skeleton";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function CalendarSkeleton({
  showWeekDay = true,
}: {
  showWeekDay?: boolean;
}) {
  return (
    <div className="w-full flex flex-col gap-4" data-testid="calendar-skeleton">
      {showWeekDay && (
        <div className="flex gap-1.5">
          {WEEKDAY_LABELS.map((label) => (
            <Skeleton key={label} className="h-9 flex-1 rounded-full" />
          ))}
        </div>
      )}

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
              <Skeleton className="h-3 w-2/6 mt-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
