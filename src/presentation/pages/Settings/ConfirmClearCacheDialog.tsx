import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";

export interface ConfirmClearCacheDialogProps {
  open: boolean;
  clearingCache: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ConfirmClearCacheDialog({
  open,
  clearingCache,
  onOpenChange,
  onConfirm,
}: ConfirmClearCacheDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>确定清理缓存数据？</DialogTitle>
          <DialogDescription>
            清理后新番日历、条目详情与 IPTV
            等数据将重新联网加载，收藏内容不受影响。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={clearingCache}
            onClick={onConfirm}
          >
            {clearingCache ? "清理中..." : "确认清理"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
