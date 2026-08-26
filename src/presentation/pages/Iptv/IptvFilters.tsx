import { Search } from "lucide-react";
import type { IptvCountry } from "@/domain/iptv/IptvSchemas";
import { Input } from "@/presentation/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/presentation/components/ui/toggle-group";
import { DEFAULT_IPTV_CATEGORY } from "../../store/iptvStore";

const ALL_CATEGORY_LABEL = "全部";

interface IptvFiltersProps {
  countries: IptvCountry[];
  selectedCountry: string;
  categories: string[];
  selectedCategory: string;
  keyword: string;
  onCountryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
}

export function IptvFilters({
  countries,
  selectedCountry,
  categories,
  selectedCategory,
  keyword,
  onCountryChange,
  onCategoryChange,
  onKeywordChange,
}: IptvFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <NativeSelect
          value={selectedCountry}
          onChange={(e) => onCountryChange(e.target.value)}
          className="w-full sm:w-56"
        >
          {countries.map((country) => (
            <NativeSelectOption key={country.code} value={country.code}>
              {country.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="搜索频道..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <ToggleGroup
          type="single"
          value={selectedCategory}
          onValueChange={onCategoryChange}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value={DEFAULT_IPTV_CATEGORY}>
            {ALL_CATEGORY_LABEL}
          </ToggleGroupItem>
          {categories.map((category) => (
            <ToggleGroupItem key={category} value={category}>
              {category}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
