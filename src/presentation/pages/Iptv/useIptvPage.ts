import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GetIptvChannelsUseCase } from "@/application/iptv/GetIptvChannelsUseCase";
import type { GetIptvCountriesUseCase } from "@/application/iptv/GetIptvCountriesUseCase";
import type { IptvChannel } from "@/domain/iptv/IptvSchemas";
import type { Logger } from "@/domain/logger/logger";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";
import { DEFAULT_IPTV_CATEGORY, useIptvStore } from "../../store/iptvStore";

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

export function useIptvPage(deps: UseIptvPageParams) {
  const { getIptvCountriesUseCase, getIptvChannelsUseCase, logger } = deps;
  const navigate = useNavigate();
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
