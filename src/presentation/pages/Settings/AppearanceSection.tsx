import { Check, Palette } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/presentation/components/ui/toggle-group";
import {
  ACCENT_PRESETS,
  type AccentId,
} from "@/presentation/hooks/useAccentTheme";
import { cn } from "@/presentation/lib/utils";

export interface AppearanceSectionProps {
  theme: string;
  onThemeChange: (theme: string) => void;
  accent: AccentId;
  onAccentChange: (accent: AccentId) => void;
}

export function AppearanceSection({
  theme,
  onThemeChange,
  accent,
  onAccentChange,
}: AppearanceSectionProps) {
  return (
    <Card className="ani-card">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Palette className="h-4 w-4 text-primary" />
          外观设置
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground font-medium">
            选择界面主题
          </span>
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => v && onThemeChange(v)}
            size="sm"
            variant="outline"
          >
            <ToggleGroupItem value="system">跟随系统</ToggleGroupItem>
            <ToggleGroupItem value="light">浅色模式</ToggleGroupItem>
            <ToggleGroupItem value="dark">深色模式</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground font-medium">选择主色调</span>
          <div className="flex items-center gap-2.5">
            {ACCENT_PRESETS.map((preset) => {
              const selected = accent === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.label}
                  aria-pressed={selected}
                  title={preset.label}
                  onClick={() => onAccentChange(preset.id)}
                  className={cn(
                    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border transition-transform",
                    selected
                      ? "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : "hover:scale-105",
                  )}
                  style={{ backgroundColor: preset.color }}
                >
                  {selected && <Check className="h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
