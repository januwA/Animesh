import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

export interface BackButtonProps {
  /** 自定义返回行为；缺省时回退到上一页（navigate(-1)） */
  onBack?: () => void;
  /** 按钮文案，默认「返回」 */
  label?: string;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | "link";
  className?: string;
}

export function BackButton({
  onBack,
  label = "返回",
  variant = "ghost",
  className,
}: BackButtonProps) {
  const navigate = useNavigate();
  const handleClick = onBack ?? (() => navigate(-1));

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleClick}
      className={cn(
        "gap-2 text-muted-foreground hover:text-foreground w-fit",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
