import { Loader2, Search, Settings2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import { Button } from "@/presentation/components/ui/button";
import { ButtonGroup } from "@/presentation/components/ui/button-group";
import { Checkbox } from "@/presentation/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/presentation/components/ui/input-group";
import { Label } from "@/presentation/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/presentation/components/ui/popover";
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
  onSubmit: (e: React.SubmitEvent) => void;
}

export function SearchForm({ form, loading, onSubmit }: SearchFormProps) {
  const { register, watch } = form;
  const keyword = watch("keyword");
  const searchEngines = watch("searchEngines");

  const engineCount = searchEngines.length;
  const engineLabel =
    engineCount === 1
      ? ENGINE_LABELS[searchEngines[0]]
      : `已选 ${engineCount} 个引擎`;

  return (
    <form onSubmit={onSubmit}>
      <ButtonGroup className="w-full">
        <ButtonGroup>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={loading} className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                {engineLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3">
              <div className="flex flex-col gap-2">
                {TORRENT_SEARCH_ENGINES.map((engine) => (
                  <div key={engine} className="flex items-center gap-2">
                    <Controller
                      name="searchEngines"
                      control={form.control}
                      render={({ field }) => {
                        const engines = field.value;
                        const checked = engines.includes(engine);
                        return (
                          <Checkbox
                            id={`engine-${engine}`}
                            checked={checked}
                            onCheckedChange={() => {
                              const next = checked
                                ? engines.filter((e) => e !== engine)
                                : [...engines, engine];
                              field.onChange(next);
                            }}
                            disabled={
                              loading || (engines.length === 1 && checked)
                            }
                          />
                        );
                      }}
                    />
                    <Label
                      htmlFor={`engine-${engine}`}
                      className="cursor-pointer font-normal"
                    >
                      {ENGINE_LABELS[engine]}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
      </ButtonGroup>
    </form>
  );
}
