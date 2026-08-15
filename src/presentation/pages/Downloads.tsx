import type { Context } from "ajanuw-context";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Layers,
  Loader2,
  Pause,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Checkbox } from "@/presentation/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/presentation/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/presentation/components/ui/field";
import { Progress } from "@/presentation/components/ui/progress";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { useMutation } from "@/presentation/hooks/useMutation";
import { formatBytes, formatError, formatLocalDate } from "@/utils";

interface SubjectGroup {
  subjectId: number;
  subjectName: string;
  items: TorrentStatusInfo[];
}

/** 按 subject_id 分组，未绑定的归入 null 组，各组内按创建时间倒序。 */
function groupTorrents(torrents: TorrentStatusInfo[]): {
  groups: SubjectGroup[];
  unbound: TorrentStatusInfo[];
} {
  const sorted = [...torrents].sort(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0),
  );
  const groupMap = new Map<number, SubjectGroup>();
  const unbound: TorrentStatusInfo[] = [];

  for (const torrent of sorted) {
    if (torrent.subject_id != null && torrent.subject_name) {
      const subjectId = torrent.subject_id;
      const group = groupMap.get(subjectId) ?? {
        subjectId,
        subjectName: torrent.subject_name,
        items: [],
      };
      group.items.push(torrent);
      groupMap.set(subjectId, group);
    } else {
      unbound.push(torrent);
    }
  }

  return { groups: [...groupMap.values()], unbound };
}

interface TorrentCardProps {
  torrent: TorrentStatusInfo;
  onViewFiles: (torrent: TorrentStatusInfo) => void;
  onTogglePause: (torrent: TorrentStatusInfo) => void;
  onDelete: (torrent: TorrentStatusInfo) => void;
  pendingPauseHash: string | null;
  pendingResumeHash: string | null;
  pendingDeleteHash: string | null;
}

function TorrentCard({
  torrent,
  onViewFiles,
  onTogglePause,
  onDelete,
  pendingPauseHash,
  pendingResumeHash,
  pendingDeleteHash,
}: TorrentCardProps) {
  const progress = torrent.total_bytes
    ? (torrent.progress_bytes / torrent.total_bytes) * 100
    : 0;

  return (
    <Card className="bg-card hover:bg-muted/30 border-border transition-all duration-300">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <CardTitle
              className="text-base font-bold text-foreground leading-normal"
              title={torrent.name}
            >
              {torrent.name}
            </CardTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted-foreground">
              <span title={torrent.info_hash}>
                Hash: {torrent.info_hash.slice(0, 8)}…
              </span>
              {torrent.created_at && (
                <span>创建时间: {formatLocalDate(torrent.created_at)}</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-0 flex flex-col gap-4">
        {/* Progress Info */}
        <div className="flex  flex-col gap-2">
          <div className="flex flex-start gap-2 text-xs font-medium">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Download className="h-3.5 w-3.5 text-primary" />
              {formatBytes(torrent.download_speed_bytes_per_sec)}/s
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Upload className="h-3.5 w-3.5 text-primary" />
              {formatBytes(torrent.upload_speed_bytes_per_sec)}/s
            </span>
            <span>
              (同伴: {torrent.peers_connected}/{torrent.peers_total})
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Storage Info & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1 text-xs">
          <div className="flex gap-4 text-muted-foreground items-center">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <HardDrive className="h-3.5 w-3.5 shrink-0" />
              已下载: {formatBytes(torrent.progress_bytes)} / 总大小:{" "}
              {formatBytes(torrent.total_bytes)}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Play / View files */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewFiles(torrent)}
              className="h-8 gap-1 text-xs font-medium"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              查看文件
            </Button>

            {/* Pause / Resume */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTogglePause(torrent)}
              className="h-8 w-8 p-0"
              disabled={
                torrent.paused
                  ? torrent.info_hash === pendingResumeHash
                  : torrent.info_hash === pendingPauseHash
              }
              title={torrent.paused ? "开始下载" : "暂停下载"}
            >
              {torrent.paused ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(torrent)}
              className="h-8 w-8 p-0"
              disabled={torrent.info_hash === pendingDeleteHash}
              title="删除下载"
            >
              {torrent.info_hash === pendingDeleteHash ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Downloads() {
  const navigate = useNavigate();
  const { pauseTorrentUseCase, resumeTorrentUseCase, deleteTorrentUseCase } =
    useDI();
  const { torrents, isLoading } = useTorrentStatus();

  // Deletion target state
  const [deleteTarget, setDeleteTarget] = useState<TorrentStatusInfo | null>(
    null,
  );
  const [deleteFiles, setDeleteFiles] = useState(false);

  // Per-card pending state：避免全局 loading 串扰禁用其他卡片
  const [pendingPauseHash, setPendingPauseHash] = useState<string | null>(null);
  const [pendingResumeHash, setPendingResumeHash] = useState<string | null>(
    null,
  );
  const [pendingDeleteHash, setPendingDeleteHash] = useState<string | null>(
    null,
  );
  // 删除乐观更新：成功后立即隐藏卡片，不等下一轮推送
  const [hiddenHashes, setHiddenHashes] = useState<Set<string>>(
    () => new Set(),
  );

  const pause = useMutation(
    (_ctx: Context, p: { infoHash: string; name: string }) =>
      pauseTorrentUseCase.execute(p.infoHash),
    {
      onSuccess: (_data, p) =>
        toast(`已暂停任务: ${p.name || p.infoHash.slice(0, 8)}`),
      onError: (err) => toast.error(`暂停失败: ${formatError(err)}`),
      onSettled: () => setPendingPauseHash(null),
    },
  );

  const resume = useMutation(
    (_ctx: Context, p: { infoHash: string; name: string }) =>
      resumeTorrentUseCase.execute(p.infoHash),
    {
      onSuccess: (_data, p) =>
        toast.success(`已开始下载任务: ${p.name || p.infoHash.slice(0, 8)}`),
      onError: (err) => toast.error(`启动失败: ${formatError(err)}`),
      onSettled: () => setPendingResumeHash(null),
    },
  );

  const del = useMutation(
    (_ctx: Context, p: { target: TorrentStatusInfo; deleteFiles: boolean }) =>
      deleteTorrentUseCase.execute(p.target.info_hash, p.deleteFiles),
    {
      onSuccess: (_data, p) => {
        toast.success("已删除任务");
        setHiddenHashes((prev) => {
          const next = new Set(prev);
          next.add(p.target.info_hash);
          return next;
        });
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(`删除任务失败: ${formatError(err)}`),
      onSettled: () => setPendingDeleteHash(null),
    },
  );

  // 过滤掉已乐观删除的卡片
  const visibleTorrents = useMemo(
    () => torrents.filter((t) => !hiddenHashes.has(t.info_hash)),
    [torrents, hiddenHashes],
  );

  const { groups, unbound } = useMemo(
    () => groupTorrents(visibleTorrents),
    [visibleTorrents],
  );

  const handleViewFiles = (torrent: TorrentStatusInfo) => {
    navigate(
      `/torrent?infoHash=${torrent.info_hash}&title=${encodeURIComponent(torrent.name)}`,
    );
  };

  const handleTogglePause = (torrent: TorrentStatusInfo) => {
    if (torrent.paused) {
      setPendingResumeHash(torrent.info_hash);
      resume.execute({ infoHash: torrent.info_hash, name: torrent.name });
    } else {
      setPendingPauseHash(torrent.info_hash);
      pause.execute({ infoHash: torrent.info_hash, name: torrent.name });
    }
  };

  const handleDelete = (torrent: TorrentStatusInfo) => {
    setDeleteTarget(torrent);
    setDeleteFiles(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">
          正在加载下载管理器...
        </p>
      </div>
    );
  }

  const renderCard = (torrent: TorrentStatusInfo) => (
    <TorrentCard
      key={torrent.info_hash}
      torrent={torrent}
      onViewFiles={handleViewFiles}
      onTogglePause={handleTogglePause}
      onDelete={handleDelete}
      pendingPauseHash={pendingPauseHash}
      pendingResumeHash={pendingResumeHash}
      pendingDeleteHash={pendingDeleteHash}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            下载管理
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            管理所有在后台进行的种子下载与边下边播任务
          </p>
        </div>
        <Badge variant="secondary" className="px-2.5 py-1">
          全部任务: {torrents.length}
        </Badge>
      </div>

      {/* Empty State */}
      {torrents.length === 0 ? (
        <Empty>
          <EmptyContent>
            <EmptyTitle>没有正在进行的下载任务</EmptyTitle>
            <EmptyDescription>
              您可以在首页搜索资源，点击"边下边播"或者"复制磁力"解析后开始下载。
            </EmptyDescription>
          </EmptyContent>
          <Button onClick={() => navigate("/")} size="sm">
            前往搜索视频
          </Button>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Bound subject groups */}
          {groups.map((group) => {
            const hasUnfinished = group.items.some((t) => !t.finished);
            return (
              <Collapsible
                key={group.subjectId}
                defaultOpen={hasUnfinished}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="group flex-1 justify-between gap-2 rounded-xl bg-card/60 border border-border px-3.5 py-2.5 h-auto hover:bg-accent/10 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
                        <Layers className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{group.subjectName}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0 text-xs font-medium text-muted-foreground">
                        <Badge variant="secondary">
                          {group.items.length} 个任务
                        </Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-2.5 gap-1.5 text-xs font-medium shrink-0"
                    onClick={() => navigate(`/subject/${group.subjectId}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    查看条目
                  </Button>
                </div>
                <CollapsibleContent className="grid gap-4">
                  {group.items.map(renderCard)}
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Unbound group */}
          {unbound.length > 0 && (
            <Collapsible defaultOpen className="flex flex-col gap-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="group flex-1 justify-between gap-2 rounded-xl bg-card/60 border border-border px-3.5 py-2.5 h-auto hover:bg-accent/10 cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground min-w-0">
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className="truncate">未关联条目</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 text-xs font-medium text-muted-foreground">
                    <Badge variant="secondary">{unbound.length} 个任务</Badge>
                    <ChevronDown className="h-4 w-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-4">
                {unbound.map(renderCard)}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              删除下载任务
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              确定要删除种子{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name || deleteTarget?.info_hash.slice(0, 8)}
              </span>{" "}
              的下载任务吗？
            </DialogDescription>
          </DialogHeader>

          {/* File deletion checkbox */}
          <Field orientation="horizontal">
            <Checkbox
              id="delete-files-checkbox"
              checked={deleteFiles}
              onCheckedChange={(checked) => setDeleteFiles(checked === true)}
            />
            <FieldContent>
              <FieldLabel
                htmlFor="delete-files-checkbox"
                className="text-xs font-medium cursor-pointer select-none"
              >
                同时删除已下载的本地缓存文件 (彻底释放磁盘空间)
              </FieldLabel>
            </FieldContent>
          </Field>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={del.loading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // v8 ignore next
                if (!deleteTarget) return;
                setPendingDeleteHash(deleteTarget.info_hash);
                del.execute({ target: deleteTarget, deleteFiles });
              }}
              disabled={del.loading}
            >
              {del.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
