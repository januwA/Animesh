import { Languages } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { Button } from "@/presentation/components/ui/button";

export interface AiTranslateButtonProps {
  infoHash: NonEmptyString;
  fileId: number;
  title: NonEmptyString;
  fileName: NonEmptyString;
}

export function AiTranslateButton({
  infoHash,
  fileId,
  title,
  fileName,
}: AiTranslateButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        navigate(
          `/play/${infoHash}/${fileId}/ai-subtitle?title=${encodeURIComponent(
            title,
          )}&fileName=${encodeURIComponent(fileName)}`,
        )
      }
      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
    >
      <Languages className="h-3.5 w-3.5" />
      AI 翻译
    </Button>
  );
}
