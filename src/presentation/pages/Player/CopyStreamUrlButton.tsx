import type { Context } from "ajanuw-context";
import { Clipboard } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import type { GetLocalIpUseCase } from "@/application/torrent/GetLocalIpUseCase";
import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/presentation/components/ui/dialog";
import { useStreamServer } from "@/presentation/context/StreamServerContext";
import { useMutation } from "@/presentation/hooks/useMutation";

export interface CopyStreamUrlButtonProps {
  infoHash: string;
  fileId: number;
  getLocalIpUseCase: Pick<GetLocalIpUseCase, "execute">;
}

export function CopyStreamUrlButton({
  infoHash,
  fileId,
  getLocalIpUseCase,
}: CopyStreamUrlButtonProps) {
  const { streamPort } = useStreamServer();
  const [fetched, setFetched] = useState(false);

  const urlMutation = useMutation<string, void>(
    async (_ctx: Context) => {
      const ip = await getLocalIpUseCase.execute();
      return `http://${ip}:${streamPort}/stream/${infoHash}/${fileId}`;
    },
    {
      onError: () => {
        // v8 ignore next
        toast.error("获取局域网地址失败");
      },
    },
  );

  const shareableUrl = urlMutation.data;

  const handleOpenChange = (open: boolean) => {
    if (open && streamPort && !fetched) {
      setFetched(true);
      urlMutation.execute();
    }
  };

  const handleCopy = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      toast.success("视频流地址已复制到剪贴板，可在外部播放器中播放");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!streamPort}
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
          {urlMutation.loading ? (
            <div className="flex items-center justify-center h-[200px]">
              <span className="text-muted-foreground">加载中...</span>
            </div>
          ) : (
            <QRCodeSVG value={shareableUrl ?? ""} size={200} />
          )}
          <Button
            onClick={handleCopy}
            className="w-full"
            disabled={!shareableUrl}
          >
            <Clipboard className="mr-2 h-4 w-4" />
            复制
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
