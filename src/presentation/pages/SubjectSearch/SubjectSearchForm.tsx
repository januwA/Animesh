import { Loader2, Search } from "lucide-react";
import type { SubmitEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/presentation/components/ui/input-group";

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
    <form onSubmit={onSubmit}>
      <InputGroup>
        <InputGroupInput
          id="subject-search-input"
          data-testid="subject-search-input"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="submit"
            disabled={loading || !keyword.trim()}
            variant="secondary"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                <InputGroupText>{searchingText}</InputGroupText>
              </>
            ) : (
              <>
                <Search />
                搜索
              </>
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
