import { Loader2 } from "lucide-react";

export function SettingsLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground font-medium">
        正在加载设置面版...
      </p>
    </div>
  );
}
