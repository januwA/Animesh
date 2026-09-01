import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/presentation/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/presentation/components/ui/collapsible";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/presentation/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import { cn } from "@/presentation/lib/utils";
import type { SearchFilter } from "@/presentation/store/searchStore";
import { DEFAULT_FILTER } from "@/presentation/store/searchStore";

const filterFormSchema = z.object({
  pubDatePreset: z.enum(["all", "24h", "week", "month"]),
});

type FilterFormValues = z.infer<typeof filterFormSchema>;

function toSearchFilter(values: FilterFormValues): SearchFilter {
  return { pubDatePreset: values.pubDatePreset };
}

interface FilterFormProps {
  onFilterChange: (filter: SearchFilter) => void;
}

export function FilterForm({ onFilterChange }: FilterFormProps) {
  const form = useForm<FilterFormValues>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: { pubDatePreset: DEFAULT_FILTER.pubDatePreset },
  });

  const pubDatePreset = form.watch("pubDatePreset");

  // biome-ignore lint/correctness/useExhaustiveDependencies: pubDatePreset 是触发过滤的必要依赖
  useEffect(() => {
    onFilterChange(toSearchFilter(form.getValues()));
  }, [pubDatePreset, onFilterChange, form]);

  const hasActiveFilter = pubDatePreset !== "all";

  const handleReset = () => {
    form.reset({ pubDatePreset: "all" });
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          data-testid="filter-trigger"
          className={cn(
            "w-full justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5 h-auto transition-all duration-300 cursor-pointer",
            hasActiveFilter
              ? "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
              : "bg-card/60 hover:bg-accent/10 hover:border-muted-foreground/30",
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="h-4 w-4" />
            筛选
          </span>
          <span className="flex items-center gap-2">
            {hasActiveFilter && (
              <span className="text-xs text-muted-foreground">已启用</span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pub-date-select">发布日期</FieldLabel>
            <NativeSelect
              id="pub-date-select"
              data-testid="pub-date-select"
              {...form.register("pubDatePreset")}
            >
              <NativeSelectOption value="all">全部</NativeSelectOption>
              <NativeSelectOption value="24h">24小时内</NativeSelectOption>
              <NativeSelectOption value="week">一周内</NativeSelectOption>
              <NativeSelectOption value="month">一个月内</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="filter-reset"
            onClick={handleReset}
            className="mt-auto h-9 gap-1.5 px-3 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </Button>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
}
