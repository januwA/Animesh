import { create } from "zustand";
import type { IptvChannel, IptvCountry } from "@/domain/iptv/IptvSchemas";

export const DEFAULT_IPTV_COUNTRY = "CN";
export const DEFAULT_IPTV_CATEGORY = "all";

interface IptvStoreState {
  iptvCountries: IptvCountry[];
  iptvSelectedCountry: string;
  iptvChannels: IptvChannel[];
  iptvChannelsCountry: string | null;
  iptvSelectedCategory: string;
  iptvKeyword: string;
  setIptvCountries: (val: IptvCountry[]) => void;
  setIptvSelectedCountry: (val: string) => void;
  setIptvChannels: (val: IptvChannel[]) => void;
  setIptvChannelsCountry: (val: string | null) => void;
  setIptvSelectedCategory: (val: string) => void;
  setIptvKeyword: (val: string) => void;
  reset: () => void;
}

const initialState = {
  iptvCountries: [] as IptvCountry[],
  iptvSelectedCountry: DEFAULT_IPTV_COUNTRY,
  iptvChannels: [] as IptvChannel[],
  iptvChannelsCountry: null as string | null,
  iptvSelectedCategory: DEFAULT_IPTV_CATEGORY,
  iptvKeyword: "",
};

export const useIptvStore = create<IptvStoreState>()((set) => ({
  ...initialState,
  setIptvCountries: (val) => set({ iptvCountries: val }),
  setIptvSelectedCountry: (val) => set({ iptvSelectedCountry: val }),
  setIptvChannels: (val) => set({ iptvChannels: val }),
  setIptvChannelsCountry: (val) => set({ iptvChannelsCountry: val }),
  setIptvSelectedCategory: (val) => set({ iptvSelectedCategory: val }),
  setIptvKeyword: (val) => set({ iptvKeyword: val }),
  reset: () => set(initialState),
}));
