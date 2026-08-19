import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";

export interface ConfirmLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmLeaveDialog({
  open,
  onOpenChange,
  onCancel,
  onConfirm,
}: ConfirmLeaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>放弃未保存的更改？</DialogTitle>
          <DialogDescription>
            当前页面存在未保存的设置，离开后这些修改将丢失。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="button" onClick={onConfirm}>
            确认离开
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
