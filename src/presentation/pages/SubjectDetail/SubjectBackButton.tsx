import { ArrowLeft } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";

export interface SubjectBackButtonProps {
  onBack: () => void;
}

export function SubjectBackButton({ onBack }: SubjectBackButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onBack}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      返回
    </Button>
  );
}
