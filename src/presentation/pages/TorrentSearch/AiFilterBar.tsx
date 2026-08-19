import { Sparkles } from "lucide-react";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";

interface AiFilterBarProps {
  aiConfigs: AiConfig[];
  selectedAiAlias: string;
  disabled: boolean;
  onSelect: (alias: string) => void;
}

export function AiFilterBar({
  aiConfigs,
  selectedAiAlias,
  disabled,
  onSelect,
}: AiFilterBarProps) {
  return (
    <div className="mx-auto w-full mb-6 -mt-4 flex items-center justify-end animate-in fade-in duration-200">
      <div className="flex items-center gap-2 bg-card border border-border backdrop-blur-md px-3 py-1 rounded-lg shadow-sm hover:border-muted-foreground/30 transition-all duration-300">
        <span className="text-[11px] font-medium text-muted-foreground select-none pl-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI 智能过滤:
        </span>
        <NativeSelect
          value={selectedAiAlias}
          onChange={(e) => onSelect(e.target.value)}
          disabled={disabled}
          className="[&_select]:h-7 [&_select]:border-0 [&_select]:bg-transparent [&_select]:py-0 [&_select]:pl-2 [&_select]:shadow-none [&_select]:text-[11px] [&_select]:font-medium [&_select]:text-muted-foreground [&_select]:cursor-pointer [&_select]:hover:text-foreground"
        >
          <NativeSelectOption value="none">
            不使用 AI (传统搜索)
          </NativeSelectOption>
          {aiConfigs.map((config) => (
            <NativeSelectOption key={config.alias} value={config.alias}>
              {config.alias}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
