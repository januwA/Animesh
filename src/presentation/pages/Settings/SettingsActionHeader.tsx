import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";

export interface SettingsActionHeaderProps {
  saving: boolean;
}

export function SettingsActionHeader({ saving }: SettingsActionHeaderProps) {
  return (
    <div className="sticky-safe-top z-20 bg-background/85 backdrop-blur-md py-3 -mx-4 px-4 flex items-center justify-between border-b border-border shadow-sm">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">软件设置</span>
      </div>
      <Button
        type="submit"
        disabled={saving}
        className="gap-1.5 text-xs font-semibold px-5 shadow-sm"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        保存设置
      </Button>
    </div>
  );
}
