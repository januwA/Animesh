import { Languages } from "lucide-react";
import { Link } from "react-router-dom";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { Button } from "@/presentation/components/ui/button";

export interface AiTranslateButtonProps {
  infoHash: NonEmptyString;
  fileId: number;
  fileName: NonEmptyString;
}

export function AiTranslateButton({
  infoHash,
  fileId,
  fileName,
}: AiTranslateButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
    >
      <Link
        to={`/play/${infoHash}/${fileId}/ai-subtitle?fileName=${encodeURIComponent(fileName)}`}
      >
        <Languages className="h-3.5 w-3.5" />
        AI 翻译
      </Link>
    </Button>
  );
}
