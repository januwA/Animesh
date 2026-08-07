import { createContext, use, useState } from "react";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import type { IptvChannel, IptvCountry } from "@/domain/iptv/IptvSchemas";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";

export const DEFAULT_IPTV_COUNTRY = "CN";
export const DEFAULT_IPTV_CATEGORY = "all";
export const DEFAULT_SEARCH_ENGINE: TorrentSearchEngine =
  TORRENT_SEARCH_ENGINES[0];

interface AppContextType {
  calendar: BangumiCalendarDay[];
  setCalendar: (val: BangumiCalendarDay[]) => void;
  calendarActiveDay: number | null;
  setCalendarActiveDay: (val: number | null) => void;
  iptvCountries: IptvCountry[];
  setIptvCountries: (val: IptvCountry[]) => void;
  iptvSelectedCountry: string;
  setIptvSelectedCountry: (val: string) => void;
  iptvChannels: IptvChannel[];
  setIptvChannels: (val: IptvChannel[]) => void;
  iptvChannelsCountry: string | null;
  setIptvChannelsCountry: (val: string | null) => void;
  iptvSelectedCategory: string;
  setIptvSelectedCategory: (val: string) => void;
  iptvKeyword: string;
  setIptvKeyword: (val: string) => void;
  searchKeyword: string;
  setSearchKeyword: (val: string) => void;
  searchEngine: TorrentSearchEngine;
  setSearchEngine: (val: TorrentSearchEngine) => void;
  searchResults: AiSearchResultItem[];
  setSearchResults: (val: AiSearchResultItem[]) => void;
  searchHasSearched: boolean;
  setSearchHasSearched: (val: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [calendar, setCalendar] = useState<BangumiCalendarDay[]>([]);
  const [calendarActiveDay, setCalendarActiveDay] = useState<number | null>(
    null,
  );
  const [iptvCountries, setIptvCountries] = useState<IptvCountry[]>([]);
  const [iptvSelectedCountry, setIptvSelectedCountry] =
    useState(DEFAULT_IPTV_COUNTRY);
  const [iptvChannels, setIptvChannels] = useState<IptvChannel[]>([]);
  const [iptvChannelsCountry, setIptvChannelsCountry] = useState<string | null>(
    null,
  );
  const [iptvSelectedCategory, setIptvSelectedCategory] = useState(
    DEFAULT_IPTV_CATEGORY,
  );
  const [iptvKeyword, setIptvKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchEngine, setSearchEngine] = useState(DEFAULT_SEARCH_ENGINE);
  const [searchResults, setSearchResults] = useState<AiSearchResultItem[]>([]);
  const [searchHasSearched, setSearchHasSearched] = useState(false);

  return (
    <AppContext
      value={{
        calendar,
        setCalendar,
        calendarActiveDay,
        setCalendarActiveDay,
        iptvCountries,
        setIptvCountries,
        iptvSelectedCountry,
        setIptvSelectedCountry,
        iptvChannels,
        setIptvChannels,
        iptvChannelsCountry,
        setIptvChannelsCountry,
        iptvSelectedCategory,
        setIptvSelectedCategory,
        iptvKeyword,
        setIptvKeyword,
        searchKeyword,
        setSearchKeyword,
        searchEngine,
        setSearchEngine,
        searchResults,
        setSearchResults,
        searchHasSearched,
        setSearchHasSearched,
      }}
    >
      {children}
    </AppContext>
  );
}

export function useAppContext() {
  const context = use(AppContext);
  /*v8 ignore next*/
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}
