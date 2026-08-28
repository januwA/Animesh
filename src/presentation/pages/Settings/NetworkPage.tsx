import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

export default function NetworkPage() {
  const { getProxyUseCase, setProxyUseCase } = useDI();
  const [proxy, setProxy] = useState("");

  const { loading } = useQuery(
    () => getProxyUseCase.execute(),
    [getProxyUseCase],
    {
      onSuccess: (result) => {
        setProxy(result.proxy ?? "");
      },
    },
  );

  const { execute: save, loading: saving } = useMutation(
    () => setProxyUseCase.execute(proxy || null),
    {
      onSuccess: () => {
        toast.success("网络设置已保存");
      },
      onError: (err) => toast.error(`保存失败: ${err.message}`),
    },
  );

  if (loading) {
    return (
      <Card className="ani-card">
        <CardContent className="p-6 text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Card className="ani-card">
        <CardHeader className="p-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Save className="h-4 w-4 text-primary" />
            网络设置
          </CardTitle>
          <CardAction>
            <Button type="submit" disabled={saving}>
              保存
            </Button>
          </CardAction>
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
              onChange={(e) => setProxy(e.target.value)}
              placeholder="http://127.0.0.1:7890 or socks5://127.0.0.1:7890 (留空不使用代理)"
            />
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
