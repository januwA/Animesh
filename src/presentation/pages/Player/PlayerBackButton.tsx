import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/presentation/components/ui/button";

export function PlayerBackButton() {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(-1)}
      className="gap-2 text-muted-foreground hover:text-foreground w-fit"
    >
      <ArrowLeft className="h-4 w-4" />
      返回
    </Button>
  );
}
