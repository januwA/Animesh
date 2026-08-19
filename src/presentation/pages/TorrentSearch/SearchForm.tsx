import { Loader2, Search } from "lucide-react";
import type { SubmitEvent } from "react";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import { Separator } from "@/presentation/components/ui/separator";

const ENGINE_LABELS: Record<TorrentSearchEngine, string> = {
  dmhy: "动漫花园",
  bangumi_moe: "萌番组",
  mikan: "蜜柑计划",
  nyaa: "Nyaa",
  acgrip: "ACG.RIP",
  anibt: "ANiBT",
};

interface SearchFormProps {
  keyword: string;
  setKeyword: (val: string) => void;
  loading: boolean;
  onSubmit: (e: SubmitEvent) => void;
  searchEngine: TorrentSearchEngine;
  setSearchEngine: (val: TorrentSearchEngine) => void;
}

export function SearchForm({
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
          <NativeSelect
            value={searchEngine}
            onChange={(e) =>
              setSearchEngine(e.target.value as TorrentSearchEngine)
            }
            disabled={loading}
            className="max-w-17.5 sm:max-w-21.25 md:max-w-none [&_select]:border-0 [&_select]:bg-transparent [&_select]:py-0 [&_select]:pl-1.5 md:[&_select]:pl-2 [&_select]:shadow-none [&_select]:text-xs md:[&_select]:text-sm [&_select]:font-medium [&_select]:text-muted-foreground [&_select]:cursor-pointer [&_select]:hover:text-foreground"
          >
            {TORRENT_SEARCH_ENGINES.map((engine) => (
              <NativeSelectOption key={engine} value={engine}>
                {ENGINE_LABELS[engine]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
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
