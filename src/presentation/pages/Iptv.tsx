import { Search, Tv } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { IptvChannel, IptvCountry } from "@/domain/iptv/IptvSchemas";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Input } from "@/presentation/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/presentation/components/ui/toggle-group";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";
import { ErrorBanner } from "../components/AppComponents";
import { LazyImage } from "../components/LazyImage";
import { DEFAULT_IPTV_CATEGORY, useIptvStore } from "../store/iptvStore";

const DEFAULT_COUNTRY_FALLBACK: IptvCountry = {
  name: "中国",
  code: "CN",
  flag: "🇨🇳",
};
const ALL_CATEGORY_LABEL = "全部";

interface ChannelCardProps {
  channel: IptvChannel;
  onClick: () => void;
}

function ChannelCard({ channel, onClick }: ChannelCardProps) {
  return (
    <div className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-200 text-left">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col w-full text-left"
        title={`播放: ${channel.name}`}
      >
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {channel.logo ? (
            <LazyImage
              className="object-contain"
              src={channel.logo}
              alt={channel.name}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="h-8 w-8 text-primary/30" />
            </div>
          )}
        </div>
        <div className="p-2 flex flex-col gap-1 flex-1 min-w-0">
          <h3 className="text-xs font-medium leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {channel.name}
          </h3>
          {channel.category && (
            <span className="text-[10px] text-muted-foreground truncate">
              {channel.category}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

function ChannelGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      data-testid="channel-grid-skeleton"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <div
          key={n}
          className="flex flex-col bg-card border border-border rounded-lg overflow-hidden"
        >
          <Skeleton className="aspect-square rounded-none" />
          <div className="p-2 flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Iptv() {
  const navigate = useNavigate();
  const { getIptvCountriesUseCase, getIptvChannelsUseCase, logger } = useDI();
  const iptvCountries = useIptvStore((s) => s.iptvCountries);
  const setIptvCountries = useIptvStore((s) => s.setIptvCountries);
  const iptvSelectedCountry = useIptvStore((s) => s.iptvSelectedCountry);
  const setIptvSelectedCountry = useIptvStore((s) => s.setIptvSelectedCountry);
  const iptvChannels = useIptvStore((s) => s.iptvChannels);
  const setIptvChannels = useIptvStore((s) => s.setIptvChannels);
  const iptvChannelsCountry = useIptvStore((s) => s.iptvChannelsCountry);
  const setIptvChannelsCountry = useIptvStore((s) => s.setIptvChannelsCountry);
  const iptvSelectedCategory = useIptvStore((s) => s.iptvSelectedCategory);
  const setIptvSelectedCategory = useIptvStore(
    (s) => s.setIptvSelectedCategory,
  );
  const iptvKeyword = useIptvStore((s) => s.iptvKeyword);
  const setIptvKeyword = useIptvStore((s) => s.setIptvKeyword);
  const iptvLogger = useMemo(() => logger.withCategory("Iptv"), [logger]);

  const [error, setError] = useState<string | null>(null);

  useQuery(
    (ctx) => getIptvCountriesUseCase.execute(ctx),
    [
      getIptvCountriesUseCase,
      iptvCountries.length,
      iptvLogger,
      setIptvCountries,
    ],
    {
      enabled: iptvCountries.length === 0,
      onSuccess: (data) => setIptvCountries(data),
      onError: (err) => {
        iptvLogger.warn("Failed to fetch IPTV countries:", err);
      },
    },
  );

  const channelsNeedsFetch = iptvChannelsCountry !== iptvSelectedCountry;
  const { loading: isLoading } = useQuery(
    (ctx) => getIptvChannelsUseCase.execute(ctx, iptvSelectedCountry),
    [
      getIptvChannelsUseCase,
      iptvSelectedCountry,
      iptvChannelsCountry,
      setIptvChannels,
      setIptvSelectedCategory,
      setIptvChannelsCountry,
    ],
    {
      enabled: channelsNeedsFetch,
      onSuccess: (data) => {
        setError(null);
        setIptvChannels(data);
        setIptvChannelsCountry(iptvSelectedCountry);
      },
      onError: (err) => {
        setError(`获取频道列表失败，请检查网络或重试: ${formatError(err)}`);
      },
    },
  );

  const selectCountries = useMemo(() => {
    if (iptvCountries.some((country) => country.code === iptvSelectedCountry)) {
      return iptvCountries;
    }
    return [DEFAULT_COUNTRY_FALLBACK, ...iptvCountries];
  }, [iptvCountries, iptvSelectedCountry]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    for (const channel of iptvChannels) {
      if (channel.category) {
        categorySet.add(channel.category);
      }
    }
    return Array.from(categorySet).sort();
  }, [iptvChannels]);

  const filteredChannels = useMemo(() => {
    const normalizedKeyword = iptvKeyword.trim().toLowerCase();
    return iptvChannels.filter((channel) => {
      if (
        iptvSelectedCategory !== DEFAULT_IPTV_CATEGORY &&
        channel.category !== iptvSelectedCategory
      ) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }
      return (
        channel.name.toLowerCase().includes(normalizedKeyword) ||
        (channel.tvgId ?? "").toLowerCase().includes(normalizedKeyword) ||
        (channel.category ?? "").toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [iptvChannels, iptvSelectedCategory, iptvKeyword]);

  const handleCountryChange = (value: string) => {
    setIptvSelectedCountry(value);
    if (iptvChannelsCountry !== value) {
      setIptvChannels([]);
      setIptvSelectedCategory(DEFAULT_IPTV_CATEGORY);
    }
  };

  const handleCategoryChange = (value: string) => {
    setIptvSelectedCategory(value || DEFAULT_IPTV_CATEGORY);
  };

  const handleChannelClick = (channel: IptvChannel) => {
    const params = new URLSearchParams({
      url: channel.url,
      name: channel.name,
      logo: channel.logo ?? "",
      category: channel.category ?? "",
    });
    navigate(`/live/play?${params.toString()}`);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <NativeSelect
            value={iptvSelectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="w-full sm:w-56"
          >
            {selectCountries.map((country) => (
              <NativeSelectOption key={country.code} value={country.code}>
                {country.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={iptvKeyword}
              onChange={(e) => setIptvKeyword(e.target.value)}
              placeholder="搜索频道..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <ToggleGroup
            type="single"
            value={iptvSelectedCategory}
            onValueChange={handleCategoryChange}
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

      {!isLoading && !error && (
        <p className="text-xs text-muted-foreground">
          共 {filteredChannels.length} 个频道
        </p>
      )}

      {isLoading && <ChannelGridSkeleton />}

      {error && <ErrorBanner message={error} />}

      {!isLoading && !error && iptvChannels.length === 0 && (
        <Empty>
          <EmptyContent>
            <EmptyTitle>该国家暂无频道</EmptyTitle>
            <EmptyDescription>请尝试切换其他国家</EmptyDescription>
          </EmptyContent>
        </Empty>
      )}

      {!isLoading &&
        !error &&
        iptvChannels.length > 0 &&
        filteredChannels.length === 0 && (
          <Empty>
            <EmptyContent>
              <EmptyTitle>没有符合筛选条件的频道</EmptyTitle>
              <EmptyDescription>请尝试其他关键词或分类</EmptyDescription>
            </EmptyContent>
          </Empty>
        )}

      {!isLoading && !error && filteredChannels.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredChannels.map((channel) => (
            <ChannelCard
              key={channel.url}
              channel={channel}
              onClick={() => handleChannelClick(channel)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
