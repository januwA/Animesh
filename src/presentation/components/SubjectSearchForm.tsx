import { Loader2, Search } from "lucide-react";
import type { SubmitEvent } from "react";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

interface SubjectSearchFormProps {
  keyword: string;
  setKeyword: (val: string) => void;
  loading: boolean;
  onSubmit: (e: SubmitEvent) => void;
  placeholder?: string;
  searchingText?: string;
}

export function SubjectSearchForm({
  keyword,
  setKeyword,
  loading,
  onSubmit,
  placeholder = "输入动漫名称",
  searchingText = "搜索中...",
}: SubjectSearchFormProps) {
  return (
    <section className="mx-auto w-full mb-4">
      <form
        onSubmit={onSubmit}
        className="relative flex items-center bg-card/40 backdrop-blur-md rounded-xl border border-border shadow-lg p-1 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300"
      >
        <Search className="h-5 w-5 text-muted-foreground shrink-0 ml-2 md:ml-3" />
        <Input
          id="subject-search-input"
          data-testid="subject-search-input"
          className="flex-1 pl-2 md:pl-3 pr-12 py-5 md:py-6 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base min-w-0"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={placeholder}
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
              <span className="hidden md:inline ml-2">{searchingText}</span>
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
