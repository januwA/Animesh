import { Clipboard } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/presentation/components/ui/dialog";

export interface CopyStreamUrlButtonProps {
  streamUrl: string | null;
}

export function CopyStreamUrlButton({ streamUrl }: CopyStreamUrlButtonProps) {
  const handleCopy = async () => {
    // v8 ignore next
    if (!streamUrl) return;
    try {
      await navigator.clipboard.writeText(streamUrl);
      toast.success("视频流地址已复制到剪贴板，可在外部播放器中播放");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!streamUrl}
          className="h-8 gap-1 text-muted-foreground hover:text-foreground"
        >
          <Clipboard className="h-4 w-4" />
          复制视频流地址
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>视频流地址</DialogTitle>
          <DialogDescription>
            扫描二维码或点击复制按钮获取流地址
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <QRCodeSVG value={streamUrl ?? ""} size={200} />
          <Button onClick={handleCopy} className="w-full">
            <Clipboard className="mr-2 h-4 w-4" />
            复制
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
