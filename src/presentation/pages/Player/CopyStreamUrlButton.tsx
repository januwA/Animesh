import { Clipboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/presentation/components/ui/button";

export interface CopyStreamUrlButtonProps {
  streamUrl: string | null;
}

export function CopyStreamUrlButton({ streamUrl }: CopyStreamUrlButtonProps) {
  const handleCopy = async () => {
    if (!streamUrl) return;
    try {
      await navigator.clipboard.writeText(streamUrl);
      toast.success("视频流地址已复制到剪贴板，可在外部播放器中播放");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
    >
      <Clipboard className="h-4 w-4" />
      复制视频流地址
    </Button>
  );
}
