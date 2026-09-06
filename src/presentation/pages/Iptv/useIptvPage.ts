import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { GetIptvChannelsUseCase } from "@/application/iptv/GetIptvChannelsUseCase";
import type { GetIptvCountriesUseCase } from "@/application/iptv/GetIptvCountriesUseCase";
import type { IptvChannel } from "@/domain/iptv/IptvSchemas";
import type { Logger } from "@/domain/logger/logger";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";

export const DEFAULT_IPTV_COUNTRY = "CN";
export const DEFAULT_IPTV_CATEGORY = "all";

const DEFAULT_COUNTRY_FALLBACK = {
  name: "中国",
  code: "CN",
  flag: "🇨🇳",
};

export interface UseIptvPageParams {
  getIptvCountriesUseCase: Pick<GetIptvCountriesUseCase, "execute">;
  getIptvChannelsUseCase: Pick<GetIptvChannelsUseCase, "execute">;
  logger: Pick<Logger, "withCategory">;
}

/**
 * 国家/频道数据由基础设施层 @Cached（30 天 / 7 天 TTL）缓存，此处不重复全局缓存：
 * - countries 使用 useQuery 本地状态；
 * - channels 按国家缓存在本地 state（挂载期间跨国家切换保留）；
 * - selectedCountry 持久化在 URL ?country= 参数中。
 */
export function useIptvPage(deps: UseIptvPageParams, countryParam?: string) {
  const { getIptvCountriesUseCase, getIptvChannelsUseCase, logger } = deps;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const iptvLogger = useMemo(() => logger.withCategory("Iptv"), [logger]);

  const [selectedCountryState, setSelectedCountryState] = useState(
    () => countryParam?.toUpperCase() ?? DEFAULT_IPTV_COUNTRY,
  );

  useEffect(() => {
    setSelectedCountryState(
      countryParam?.toUpperCase() ?? DEFAULT_IPTV_COUNTRY,
    );
  }, [countryParam]);

  const iptvSelectedCountry = selectedCountryState;

  const { data: countriesData } = useQuery(
    (ctx) => getIptvCountriesUseCase.execute(ctx),
    [getIptvCountriesUseCase, iptvLogger],
    {
      onError: (err) => {
        iptvLogger.warn("Failed to fetch IPTV countries:", err);
      },
    },
  );
  const iptvCountries = countriesData ?? [];

  const [channelsCache, setChannelsCache] = useState<
    Record<string, IptvChannel[]>
  >({});
  const cachedChannels = channelsCache[iptvSelectedCountry];

  const [error, setError] = useState<string | null>(null);

  const { loading: channelsLoading } = useQuery(
    (ctx) => getIptvChannelsUseCase.execute(ctx, iptvSelectedCountry),
    [getIptvChannelsUseCase, iptvSelectedCountry],
    {
      enabled: cachedChannels === undefined,
      onSuccess: (data) => {
        setError(null);
        setChannelsCache((prev) => ({
          ...prev,
          [iptvSelectedCountry]: data,
        }));
      },
      onError: (err) => {
        setError(`获取频道列表失败，请检查网络或重试: ${formatError(err)}`);
      },
    },
  );

  const iptvChannels = cachedChannels ?? [];
  const isLoading = cachedChannels === undefined && channelsLoading;

  const [iptvSelectedCategory, setSelectedCategory] = useState(
    DEFAULT_IPTV_CATEGORY,
  );
  const [iptvKeyword, setIptvKeyword] = useState("");

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

  const handleCountryChange = useCallback(
    (value: string) => {
      if (value === iptvSelectedCountry) return;
      // 切换国家时重置分类并清掉上一个国家的错误提示
      setSelectedCountryState(value);
      setSelectedCategory(DEFAULT_IPTV_CATEGORY);
      setError(null);
      const next = new URLSearchParams(searchParams);
      next.set("country", value);
      setSearchParams(next, { replace: true });
    },
    [iptvSelectedCountry, searchParams, setSearchParams],
  );

  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value || DEFAULT_IPTV_CATEGORY);
  }, []);

  const handleChannelClick = useCallback(
    (channel: IptvChannel) => {
      const params = new URLSearchParams({
        url: channel.url,
        name: channel.name,
        logo: channel.logo ?? "",
        category: channel.category ?? "",
      });
      navigate(`/live/play?${params.toString()}`);
    },
    [navigate],
  );

  return {
    iptvSelectedCountry,
    iptvSelectedCategory,
    iptvKeyword,
    iptvChannels,
    selectCountries,
    categories,
    filteredChannels,
    isLoading,
    error,
    setIptvKeyword,
    handleCountryChange,
    handleCategoryChange,
    handleChannelClick,
  };
}
