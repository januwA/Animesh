import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/presentation/components/ui/dialog";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useBangumiCalendarStore } from "@/presentation/store/bangumiCalendarStore";
import { useIptvStore } from "@/presentation/store/iptvStore";

export default function CachePage() {
  const { clearCacheUseCase } = useDI();
  const setCalendar = useBangumiCalendarStore((s) => s.setCalendar);
  const setIptvCountries = useIptvStore((s) => s.setIptvCountries);
  const setIptvChannels = useIptvStore((s) => s.setIptvChannels);

  const { execute: handleConfirmClearCache, loading: clearingCache } =
    useMutation(() => clearCacheUseCase.execute(), {
      onSuccess: () => {
        setCalendar([]);
        setIptvCountries([]);
        setIptvChannels([]);
        toast.success("缓存已清理");
      },
      onError: (err) => toast.error(`清理缓存失败: ${err.message}`),
    });

  return (
    <Card className="ani-card">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Trash2 className="h-4 w-4 text-primary" />
          缓存管理
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-6 flex flex-col gap-4 text-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border bg-secondary/30 rounded-lg p-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">清理缓存数据</p>
            <p className="text-muted-foreground leading-relaxed">
              清理新番日历、条目详情、剧集/角色/制作人员与 IPTV
              等联网缓存数据，清理后相关页面需重新联网加载。收藏数据不会被清除。
            </p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" disabled={clearingCache}>
                {clearingCache ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                清理缓存
              </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>确定清理缓存数据？</DialogTitle>
                <DialogDescription>
                  清理后新番日历、条目详情与 IPTV 等数据将重新联网加载。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={clearingCache}
                  onClick={() => handleConfirmClearCache()}
                >
                  {clearingCache ? "清理中..." : "确认清理"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
