import { Globe, Lightbulb } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";

export interface NetworkSettingsSectionProps {
  proxy: string;
  onProxyChange: (value: string) => void;
}

export function NetworkSettingsSection({
  proxy,
  onProxyChange,
}: NetworkSettingsSectionProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Globe className="h-4 w-4 text-primary" />
          网络设置
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="proxy-input"
            className="text-muted-foreground font-medium"
          >
            代理服务器地址
          </label>
          <Input
            id="proxy-input"
            value={proxy}
            onChange={(e) => onProxyChange(e.target.value)}
            placeholder="例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:7890 (留空则不使用代理)"
            className="bg-secondary/30 border-border text-foreground py-5 text-xs"
          />
          <p className="text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
            <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <span>
              提示：部分地区可能有网络问题 搜索无结果，可配置代理。支持
              HTTP、HTTPS 或 SOCKS5 代理。
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
