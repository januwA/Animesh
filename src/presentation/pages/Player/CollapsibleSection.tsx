import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/presentation/components/ui/collapsible";

export interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-xl border border-border bg-muted/50"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3.5 text-left">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
          {badge !== undefined && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
