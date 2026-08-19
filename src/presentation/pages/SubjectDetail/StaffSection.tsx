import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { StaffPersonBadge } from "./StaffPersonBadge";
import type { ConsolidatedStaffMember } from "./useSubjectDetail";

export interface StaffSectionProps {
  staffGroupedByRole: Map<string, ConsolidatedStaffMember[]>;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function StaffSection({
  staffGroupedByRole,
  loading,
  error,
  onRetry,
}: StaffSectionProps) {
  if (error) {
    return (
      <ErrorState
        title="获取制作人员数据失败"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="staff-skeleton">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-7 w-20 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (staffGroupedByRole.size === 0) {
    return (
      <Empty className="py-8">
        <EmptyContent>
          <EmptyTitle>暂无制作人员数据</EmptyTitle>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(staffGroupedByRole.entries()).map(([role, people]) => (
        <div key={role} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {role}
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
              {people.length}
            </span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {people.map((person) => (
              <StaffPersonBadge key={`${person.id}-${role}`} person={person} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
