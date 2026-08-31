import { Loader2, Search } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import { ButtonGroup } from "@/presentation/components/ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/presentation/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import type { TorrentSearchFormValues } from "./useTorrentSearchPage";

const ENGINE_LABELS: Record<TorrentSearchEngine, string> = {
  dmhy: "动漫花园",
  bangumi_moe: "萌番组",
  mikan: "蜜柑计划",
  nyaa: "Nyaa",
  acgrip: "ACG.RIP",
  anibt: "ANiBT",
};

interface SearchFormProps {
  form: UseFormReturn<TorrentSearchFormValues>;
  loading: boolean;
  aiConfigs: AiConfig[];
  onSubmit: (e: React.FormEvent) => void;
}

export function SearchForm({
  form,
  loading,
  aiConfigs,
  onSubmit,
}: SearchFormProps) {
  const { register, watch } = form;
  const keyword = watch("keyword");

  return (
    <form onSubmit={onSubmit}>
      <ButtonGroup className="w-full">
        <ButtonGroup>
          <NativeSelect {...register("searchEngine")} disabled={loading}>
            {TORRENT_SEARCH_ENGINES.map((engine) => (
              <NativeSelectOption key={engine} value={engine}>
                {ENGINE_LABELS[engine]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </ButtonGroup>

        <ButtonGroup className="flex-1">
          <InputGroup>
            <InputGroupInput
              id="search-input"
              data-testid="search-input"
              {...register("keyword")}
              placeholder="输入动漫名称"
              disabled={loading}
            />

            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                disabled={loading || !keyword?.trim()}
                variant="secondary"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <InputGroupText>搜索中...</InputGroupText>
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
        </ButtonGroup>

        {aiConfigs.length > 0 && (
          <ButtonGroup>
            <NativeSelect {...register("aiAlias")} disabled={loading}>
              <NativeSelectOption value="none">传统搜索</NativeSelectOption>
              {aiConfigs.map((config) => (
                <NativeSelectOption key={config.alias} value={config.alias}>
                  {config.alias}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </ButtonGroup>
        )}
      </ButtonGroup>
    </form>
  );
}
