import type { ConsolidatedStaffMember } from "@/presentation/pages/SubjectDetail/useSubjectCast";

export interface StaffPersonBadgeProps {
  person: ConsolidatedStaffMember;
}

export function StaffPersonBadge({ person }: StaffPersonBadgeProps) {
  return (
    <div className="px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/50 text-sm transition-colors hover:bg-secondary">
      <span className="text-xs font-medium text-foreground">{person.name}</span>
      {person.eps && (
        <span className="text-[10px] text-muted-foreground">
          ({person.eps})
        </span>
      )}
    </div>
  );
}
