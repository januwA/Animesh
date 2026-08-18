import type { Context } from "ajanuw-context";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Loader2,
  Pause,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/presentation/components/ui/alert-dialog";
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
  onDelete: (torrent: TorrentStatusInfo, deleteFiles: boolean) => void;
  delLoading: boolean;
  pendingPauseHash: string | null;
  pendingResumeHash: string | null;
  pendingDeleteHash: string | null;
}

function TorrentCard({
  torrent,
  onViewFiles,
  onTogglePause,
  onDelete,
  delLoading,
  pendingPauseHash,
  pendingResumeHash,
  pendingDeleteHash,
}: TorrentCardProps) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const progress = torrent.total_bytes
    ? (torrent.progress_bytes / torrent.total_bytes) * 100
    : 0;

  return (
    <Card className="bg-card hover:bg-muted/30 border-border transition-all duration-300">
      <CardHeader>
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <CardTitle>{torrent.name}</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {torrent.created_at && (
              <span>创建时间: {formatLocalDate(torrent.created_at)}</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={torrent.info_hash === pendingDeleteHash}
                  title="删除下载"
                  onClick={() => setDeleteFiles(false)}
                >
                  {torrent.info_hash === pendingDeleteHash ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除下载任务</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除种子
                    <span
                      className="font-semibold text-foreground"
                      data-testid="delete-dialog-torrent-name"
                    >
                      {torrent.name}
                    </span>
                    的下载任务吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Field orientation="horizontal">
                  <Checkbox
                    id={`delete-files-${torrent.info_hash}`}
                    checked={deleteFiles}
                    onCheckedChange={(checked) =>
                      setDeleteFiles(checked === true)
                    }
                  />
                  <FieldContent>
                    <FieldLabel
                      htmlFor={`delete-files-${torrent.info_hash}`}
                      className="text-xs font-medium cursor-pointer select-none"
                    >
                      同时删除已下载的本地缓存文件 (彻底释放磁盘空间)
                    </FieldLabel>
                  </FieldContent>
                </Field>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={delLoading}
                    onClick={() => onDelete(torrent, deleteFiles)}
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface GroupPanelProps {
  title: string;
  items: TorrentStatusInfo[];
  defaultOpen: boolean;
  action?: ReactNode;
  children: ReactNode;
}

/** 分组面板：可折叠头部 + 聚合进度/操作条 + 任务卡片网格，自适应 PC 与手机。 */
function GroupPanel({
  title,
  items,
  defaultOpen,
  action,
  children,
}: GroupPanelProps) {
  const total = items.length;

  return (
    <Collapsible defaultOpen={defaultOpen} className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card">
        <div className="flex items-center gap-2 px-4 py-3.5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg py-1 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                {title}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{total}</Badge>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </span>
            </button>
          </CollapsibleTrigger>
          {action}
        </div>
      </div>

      <CollapsibleContent className="grid gap-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export default function Downloads() {
  const navigate = useNavigate();
  const { pauseTorrentUseCase, resumeTorrentUseCase, deleteTorrentUseCase } =
    useDI();
  const { torrents, isLoading } = useTorrentStatus();

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

  const pauseMutation = useMutation(
    (_ctx: Context, p: { infoHash: NonEmptyString; name: NonEmptyString }) =>
      pauseTorrentUseCase.execute(p.infoHash),
    {
      onSuccess: (_data, p) => toast(`已暂停任务: ${p.name}`),
      onError: (err) => toast.error(`暂停失败: ${formatError(err)}`),
      onSettled: () => setPendingPauseHash(null),
    },
  );

  const resumeMutation = useMutation(
    (_ctx: Context, p: { infoHash: NonEmptyString; name: NonEmptyString }) =>
      resumeTorrentUseCase.execute(p.infoHash),
    {
      onSuccess: (_data, p) => toast.success(`已开始下载任务: ${p.name}`),
      onError: (err) => toast.error(`启动失败: ${formatError(err)}`),
      onSettled: () => setPendingResumeHash(null),
    },
  );

  const delMutation = useMutation(
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
      resumeMutation.execute({
        infoHash: torrent.info_hash,
        name: torrent.name,
      });
    } else {
      setPendingPauseHash(torrent.info_hash);
      pauseMutation.execute({
        infoHash: torrent.info_hash,
        name: torrent.name,
      });
    }
  };

  const handleDelete = (target: TorrentStatusInfo, deleteFiles: boolean) => {
    setPendingDeleteHash(target.info_hash);
    delMutation.execute({ target, deleteFiles });
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
      delLoading={delMutation.loading}
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
              <GroupPanel
                key={group.subjectId}
                title={group.subjectName}
                items={group.items}
                defaultOpen={hasUnfinished}
                action={
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="查看条目"
                    title="查看条目"
                    onClick={() => navigate(`/subject/${group.subjectId}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                }
              >
                {group.items.map(renderCard)}
              </GroupPanel>
            );
          })}

          {/* Unbound group */}
          {unbound.length > 0 && (
            <GroupPanel title="未关联条目" items={unbound} defaultOpen>
              {unbound.map(renderCard)}
            </GroupPanel>
          )}
        </div>
      )}
    </div>
  );
}
