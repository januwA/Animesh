import { useDI } from "@/di/DIContext";
import { ErrorBanner } from "@/presentation/components/AppComponents";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { ChannelCard } from "./ChannelCard";
import { ChannelGridSkeleton } from "./ChannelGridSkeleton";
import { IptvFilters } from "./IptvFilters";
import { useIptvPage } from "./useIptvPage";

export default function Iptv() {
  const { getIptvCountriesUseCase, getIptvChannelsUseCase, logger } = useDI();

  const {
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
  } = useIptvPage({ getIptvCountriesUseCase, getIptvChannelsUseCase, logger });

  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="ani-card">
        <CardContent>
          <IptvFilters
            countries={selectCountries}
            selectedCountry={iptvSelectedCountry}
            categories={categories}
            selectedCategory={iptvSelectedCategory}
            keyword={iptvKeyword}
            onCountryChange={handleCountryChange}
            onCategoryChange={handleCategoryChange}
            onKeywordChange={setIptvKeyword}
          />
        </CardContent>
      </Card>

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
