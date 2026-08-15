import {
  Bot,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Magnet,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { SubmitEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { ErrorState } from "@/presentation/components/ErrorState";
import { Alert, AlertDescription } from "@/presentation/components/ui/alert";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
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
import { Input } from "@/presentation/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Separator } from "@/presentation/components/ui/separator";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { sanitizeHtml } from "@/presentation/lib/sanitizeHtml";
import { cn } from "@/presentation/lib/utils";
import { formatLocalDate } from "@/utils";
import type { TorrentResultGroup } from "../store/searchStore";
import { useSearchStore } from "../store/searchStore";

const ENGINE_LABELS: Record<TorrentSearchEngine, string> = {
  dmhy: "动漫花园",
  bangumi_moe: "萌番组",
  mikan: "蜜柑计划",
  nyaa: "Nyaa",
  acgrip: "ACG.RIP",
  anibt: "ANiBT",
};

// 搜索栏组件
interface SearchFormProps {
  keyword: string;
  setKeyword: (val: string) => void;
  loading: boolean;
  onSubmit: (e: SubmitEvent) => void;
  searchEngine: TorrentSearchEngine;
  setSearchEngine: (val: TorrentSearchEngine) => void;
}

function SearchForm({
  keyword,
  setKeyword,
  loading,
  onSubmit,
  searchEngine,
  setSearchEngine,
}: SearchFormProps) {
  return (
    <section className="mx-auto w-full mb-8">
      <form
        onSubmit={onSubmit}
        className="relative flex items-center bg-card/40 backdrop-blur-md rounded-xl border border-border shadow-lg p-1 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300"
      >
        <div className="flex items-center pl-1.5 md:pl-3 gap-0.5 md:gap-1">
          <Search className="h-5 w-5 text-muted-foreground shrink-0 hidden md:block" />
          <Select
            value={searchEngine}
            onValueChange={setSearchEngine}
            disabled={loading}
          >
            <SelectTrigger className="h-8 border-0 bg-transparent py-0 px-1.5 md:px-2 shadow-none focus:ring-0 focus-visible:ring-0 text-xs md:text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer gap-0.5 md:gap-1 max-w-17.5 sm:max-w-21.25 md:max-w-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TORRENT_SEARCH_ENGINES.map((engine) => (
                <SelectItem key={engine} value={engine}>
                  {ENGINE_LABELS[engine]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator
          orientation="vertical"
          className="h-5 self-center shrink-0"
        />
        <Input
          id="search-input"
          data-testid="search-input"
          className="flex-1 pl-2 md:pl-3 pr-12 md:pr-28 py-5 md:py-6 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base min-w-0"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="输入动漫名称"
          disabled={loading}
        />
        <Button
          type="submit"
          className="absolute right-1.5 md:right-2 w-9 md:w-auto h-9 md:h-10 px-0 md:px-6 font-medium flex items-center justify-center shrink-0"
          disabled={loading || !keyword.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span className="hidden md:inline ml-2">搜索中...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 md:hidden" />
              <span className="hidden md:inline">搜索</span>
            </>
          )}
        </Button>
      </form>
    </section>
  );
}

interface SearchLoadingProps {
  onCancel: () => void;
}

// 搜索加载指示器
function SearchLoading({ onCancel }: SearchLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground font-medium">
        正在获取资源列表...
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        className="text-xs text-muted-foreground hover:text-foreground mt-2"
      >
        取消搜索
      </Button>
    </div>
  );
}

// 初始引导推荐组件
function WelcomeGuide() {
  return (
    <div className="mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-muted-foreground/75">
      <Card className="bg-card/25 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            聚合搜索
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          一键检索动漫花园资源列表，快速检索并汇总磁力资源。
        </CardContent>
      </Card>
      <Card className="bg-card/25 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-primary fill-current" />
            边下边播
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          内置高性能 BT 流媒体播放引擎，无须等待下载完毕，边下边放。
        </CardContent>
      </Card>
      <Card className="bg-card/25 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" />
            外部播放
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          支持一键拷贝本地视频流 URL，可在 VLC 或 PotPlayer 中播放。
        </CardContent>
      </Card>
    </div>
  );
}

// 搜索结果卡片组件
interface SearchResultCardProps {
  item: AiSearchResultItem;
  index: number;
  onCopyMagnet: (magnet: string) => void;
  onPlay: (magnet: string, title: string) => void;
  isBestAi?: boolean;
}

function SearchResultCard({
  item,
  index,
  onCopyMagnet,
  onPlay,
  isBestAi = false,
}: SearchResultCardProps) {
  return (
    <Card
      id={`torrent-item-${index}`}
      className={cn(
        "group transition-all duration-300",
        isBestAi
          ? "border-primary/30 bg-linear-to-br from-primary/10 via-card to-accent/20 shadow-sm hover:border-primary/50"
          : "border-border bg-card/60 hover:border-primary/25 hover:bg-accent/40",
      )}
    >
      <CardHeader className="p-5 pb-3">
        {item.ai_score !== undefined && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 px-2.5 py-0.5 font-medium",
                isBestAi
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              {isBestAi ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <Bot className="h-3 w-3" />
              )}
              {isBestAi ? "AI 智能精选推荐" : "AI 评分过滤"}
            </Badge>
            <Badge
              variant="outline"
              className={cn("gap-1 px-2.5 py-0.5 font-mono font-semibold")}
            >
              匹配度: {item.ai_score}分
            </Badge>
          </div>
        )}
        <CardTitle className="text-base font-semibold leading-relaxed group-hover:text-primary transition-colors">
          {item.title}
        </CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatLocalDate(item.pub_date)}</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0 flex flex-col gap-3">
        {item.ai_reason && (
          <Alert variant="default" className="text-xs py-3 px-3">
            <AlertDescription className="text-xs font-medium">
              <span className="font-semibold">推荐理由：</span>
              {item.ai_reason}
            </AlertDescription>
          </Alert>
        )}
        {item.description && (
          <Collapsible
            className="group/desc"
            data-testid={`torrent-desc-${index}`}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                data-testid={`torrent-desc-toggle-${index}`}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                描述
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-data-[state=open]/desc:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div
                className="mt-2 text-xs text-muted-foreground leading-relaxed break-words"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: 内容已通过 sanitizeHtml 使用 DOMPurify 净化
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(item.description),
                }}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
      <CardFooter className="px-5 py-3.5 border-t border-border flex items-center justify-between gap-4 bg-muted/30">
        <a
          href={String(item.link)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          title="在浏览器中打开网页"
        >
          <Globe className="h-3.5 w-3.5" />
          网页
        </a>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCopyMagnet(item.magnet)}
            className="h-8 text-xs font-medium gap-1.5"
          >
            <Magnet className="h-3.5 w-3.5" />
            复制磁力
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onPlay(item.magnet, item.title)}
            className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            边下边播
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// 按字幕组分组的可折叠结果区
interface SearchResultGroupProps {
  group: TorrentResultGroup;
  open: boolean;
  onOpenChange: () => void;
  onCopyMagnet: (magnet: string) => void;
  onPlay: (magnet: string, title: string) => void;
  showBestAi: boolean;
}

function SearchResultGroup({
  group,
  open,
  onOpenChange,
  onCopyMagnet,
  onPlay,
  showBestAi,
}: SearchResultGroupProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          data-testid={`group-trigger-${group.name}`}
          className="w-full justify-between gap-2 rounded-xl bg-card/60 border border-border px-3.5 py-2.5 h-auto hover:bg-accent/10 hover:border-muted-foreground/30 transition-all duration-300 cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{group.name}</span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">{group.items.length} 个</Badge>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-300",
                open && "rotate-180",
              )}
            />
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid gap-4">
          {group.items.map((item, innerIndex) => {
            const flatIndex = group.startIndex + innerIndex;
            const isBest =
              showBestAi && flatIndex === 0 && item.ai_score !== undefined;
            return (
              <SearchResultCard
                key={flatIndex.toString()}
                item={item}
                index={flatIndex}
                onCopyMagnet={onCopyMagnet}
                onPlay={onPlay}
                isBestAi={isBest}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function TorrentSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    searchTorrentsUseCase,
    searchTorrentsWithAiUseCase,
    getSettingsUseCase,
  } = useDI();

  const searchKeyword = useSearchStore((s) => s.searchKeyword);
  const setSearchKeyword = useSearchStore((s) => s.setSearchKeyword);
  const searchEngine = useSearchStore((s) => s.searchEngine);
  const setSearchEngine = useSearchStore((s) => s.setSearchEngine);
  const searchResults = useSearchStore((s) => s.searchResults);
  const setSearchResults = useSearchStore((s) => s.setSearchResults);
  const searchHasSearched = useSearchStore((s) => s.searchHasSearched);
  const setSearchHasSearched = useSearchStore((s) => s.setSearchHasSearched);

  const [selectedAiAlias, setSelectedAiAlias] = useState<string>(
    () => localStorage.getItem("animesh_selected_ai_alias") || "none",
  );

  const aiQuery = useQuery(
    () => getSettingsUseCase.execute(),
    [getSettingsUseCase],
  );
  const aiConfigs = aiQuery.data?.ai_configs ?? [];

  const searchMutation = useMutation<
    AiSearchResultItem[],
    { queryText: string; engine: TorrentSearchEngine; aiAlias: string }
  >(
    (ctx, params) => {
      const dto = { keyword: params.queryText, engine: params.engine };
      return params.aiAlias !== "none"
        ? searchTorrentsWithAiUseCase.execute(ctx, {
            ...dto,
            aiAlias: params.aiAlias,
          })
        : searchTorrentsUseCase.execute(ctx, dto);
    },
    {
      onSuccess: (data) => setSearchResults(data),
      onError: () => setSearchResults([]),
    },
  );

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("animesh_search_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const groups = useSearchStore((s) => s.groups);

  const collapsedGroups = useSearchStore((s) => s.collapsedGroups);
  const toggleGroup = useSearchStore((s) => s.toggleGroup);
  const collapseAllGroups = useSearchStore((s) => s.collapseAllGroups);
  const expandAllGroups = useSearchStore((s) => s.expandAllGroups);

  // 仅当搜索结果集合变化（新一次搜索）时重置为全部展开
  const prevResultsRef = useRef(searchResults);
  useEffect(() => {
    if (prevResultsRef.current !== searchResults) {
      prevResultsRef.current = searchResults;
      expandAllGroups();
    }
  }, [searchResults, expandAllGroups]);

  const allGroupsCollapsed =
    groups.length > 0 && collapsedGroups.size === groups.length;

  const groupNames = groups.map((g) => g.name);

  const keywordParam = searchParams.get("keyword");

  const performSearch = useCallback(
    (queryText: string) => {
      setSearchHasSearched(true);

      setHistory((prev) => {
        const filtered = prev.filter((item) => item !== queryText);
        const nextHistory = [queryText, ...filtered];
        localStorage.setItem(
          "animesh_search_history",
          JSON.stringify(nextHistory),
        );
        return nextHistory;
      });

      searchMutation.execute({
        queryText,
        engine: searchEngine,
        aiAlias: selectedAiAlias,
      });
    },
    [
      searchEngine,
      selectedAiAlias,
      searchMutation.execute,
      setSearchHasSearched,
    ],
  );

  useEffect(() => {
    if (keywordParam) {
      const query = keywordParam.trim();
      if (query) {
        setSearchKeyword(query);
        setSearchParams({}, { replace: true });
        performSearch(query);
      }
    }
  }, [keywordParam, setSearchParams, performSearch, setSearchKeyword]);

  function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    performSearch(searchKeyword.trim());
  }

  const handleDeleteHistory = (item: string) => {
    setHistory((prev) => {
      const nextHistory = prev.filter((x) => x !== item);
      if (nextHistory.length === 0) {
        localStorage.removeItem("animesh_search_history");
      } else {
        localStorage.setItem(
          "animesh_search_history",
          JSON.stringify(nextHistory),
        );
      }
      return nextHistory;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("animesh_search_history");
  };

  const handleCopyMagnet = async (magnet: string) => {
    try {
      await navigator.clipboard.writeText(magnet);
      toast.success("磁力链接已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const handlePlay = (magnet: string, title: string) => {
    navigate(
      `/torrent?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`,
    );
  };

  return (
    <>
      {/* 搜索区域 */}
      <SearchForm
        keyword={searchKeyword}
        setKeyword={setSearchKeyword}
        loading={searchMutation.loading}
        onSubmit={handleSearch}
        searchEngine={searchEngine}
        setSearchEngine={setSearchEngine}
      />

      {/* AI 智能过滤开关 */}
      {aiConfigs.length > 0 && (
        <div className="mx-auto w-full mb-6 -mt-4 flex items-center justify-end animate-in fade-in duration-200">
          <div className="flex items-center gap-2 bg-card border border-border backdrop-blur-md px-3 py-1 rounded-lg shadow-sm hover:border-muted-foreground/30 transition-all duration-300">
            <span className="text-[11px] font-medium text-muted-foreground select-none pl-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI 智能过滤:
            </span>
            <Select
              value={selectedAiAlias}
              onValueChange={(val) => {
                setSelectedAiAlias(val);
                localStorage.setItem("animesh_selected_ai_alias", val);
              }}
              disabled={searchMutation.loading}
            >
              <SelectTrigger className="h-7 border-0 bg-transparent py-0 px-2 shadow-none focus:ring-0 focus-visible:ring-0 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不使用 AI (传统搜索)</SelectItem>
                {aiConfigs.map((config) => (
                  <SelectItem key={config.alias} value={config.alias}>
                    {config.alias}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 搜索历史记录 */}
      {history.length > 0 && (
        <div className="mx-auto w-full mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="flex items-center gap-1 font-medium">
            <Clock className="h-3.5 w-3.5" />
            最近搜索:
          </span>
          {history.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1 px-2.5 py-0.5"
              onClick={() => setSearchKeyword(item)}
            >
              {item}
              <button
                type="button"
                data-testid={`delete-history-${item}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteHistory(item);
                }}
                className="text-muted-foreground hover:text-foreground rounded-full p-0.5 hover:bg-accent transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] ml-auto text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleClearHistory}
          >
            清空
          </Button>
        </div>
      )}

      {/* 加载提示 */}
      {searchMutation.loading &&
        (selectedAiAlias !== "none" ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in duration-300">
            <div className="relative flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
              <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-xl animate-pulse" />{" "}
              {/* style-ignore */}
            </div>
            <p className="text-sm font-semibold bg-linear-to-r from-cyan-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent animate-pulse">
              AI 正在搜索，可能需要数秒，请稍候...
            </p>
            <p className="text-xs text-muted-foreground max-w-xs text-center leading-relaxed">
              正在分析意图，并根据需要在不同搜索引擎间自动检索 Fallback...
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={searchMutation.cancel}
              className="text-xs text-muted-foreground hover:text-foreground mt-2 border-border bg-secondary/50"
            >
              取消搜索
            </Button>
          </div>
        ) : (
          <SearchLoading onCancel={searchMutation.cancel} />
        ))}

      {searchMutation.error && (
        <ErrorState
          message={searchMutation.error}
          title="搜索失败"
          onRetry={() => performSearch(searchKeyword)}
        />
      )}

      {/* 未搜索空状态或结果为空提示 */}
      {!searchMutation.loading &&
        !searchMutation.error &&
        (searchHasSearched && searchResults.length === 0 ? (
          <Empty>
            <EmptyContent>
              <EmptyTitle>未找到相关资源</EmptyTitle>
              <EmptyDescription>请换个关键词试试</EmptyDescription>
            </EmptyContent>
          </Empty>
        ) : !searchHasSearched ? (
          <WelcomeGuide />
        ) : null)}

      {/* 搜索结果列表 */}
      {!searchMutation.loading &&
        !searchMutation.error &&
        searchResults.length > 0 && (
          <section className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="results-count text-sm text-muted-foreground">
                找到{" "}
                <span className="font-semibold text-primary">
                  {searchResults.length}
                </span>{" "}
                个资源，共{" "}
                <span className="font-semibold text-primary">
                  {groups.length}
                </span>{" "}
                个字幕组
              </div>
              <Button
                variant="ghost"
                size="sm"
                data-testid="toggle-all-groups"
                onClick={
                  allGroupsCollapsed
                    ? expandAllGroups
                    : () => collapseAllGroups(groupNames)
                }
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {allGroupsCollapsed ? "全部展开" : "全部折叠"}
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <SearchResultGroup
                  key={group.name}
                  group={group}
                  open={!collapsedGroups.has(group.name)}
                  onOpenChange={() => toggleGroup(group.name)}
                  onCopyMagnet={handleCopyMagnet}
                  onPlay={handlePlay}
                  showBestAi={selectedAiAlias !== "none"}
                />
              ))}
            </div>
          </section>
        )}
    </>
  );
}
