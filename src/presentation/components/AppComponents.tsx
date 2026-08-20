import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

// 错误横幅
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="max-w-2xl mx-auto w-full py-4">
      <Alert variant="destructive">
        <AlertTitle className="font-semibold">搜索失败</AlertTitle>
        <AlertDescription className="text-sm">{message}</AlertDescription>
      </Alert>
    </div>
  );
}

// 页面懒加载 Loading 占位组件
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in duration-300">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground font-medium">
        正在载入页面...
      </p>
    </div>
  );
}
