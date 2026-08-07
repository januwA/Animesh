import { AlertTriangle, RotateCw } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/presentation/components/ui/alert";
import { Button } from "@/presentation/components/ui/button";
import { formatError } from "@/utils";

interface ErrorStateProps {
  /** 错误信息，Error 类型会自动使用 formatError 格式化 */
  message: string | Error;
  /** 点击重试按钮时的回调 */
  onRetry: () => void;
  /** 错误标题，默认 "加载失败" */
  title?: string;
}

export function ErrorState({
  message,
  onRetry,
  title = "加载失败",
}: ErrorStateProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{formatError(message)}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" />
          重试
        </Button>
      </AlertAction>
    </Alert>
  );
}
