import { useAnilistCalendarStore } from "@/presentation/store/anilistCalendarStore";
import { useAnilistNextSeasonStore } from "@/presentation/store/anilistNextSeasonStore";
import { useAnilistSearchStore } from "@/presentation/store/anilistSearchStore";
import { useBangumiCalendarStore } from "@/presentation/store/bangumiCalendarStore";
import { useBangumiSearchStore } from "@/presentation/store/bangumiSearchStore";
import { useCollectionsStore } from "@/presentation/store/collectionsStore";
import { useIptvStore } from "@/presentation/store/iptvStore";
import { useNextSeasonStore } from "@/presentation/store/nextSeasonStore";
import { useSearchHistoryStore } from "@/presentation/store/searchHistoryStore";
import { useSearchStore } from "@/presentation/store/searchStore";

export function resetAppStores(): void {
  useAnilistCalendarStore.getState().reset();
  useAnilistNextSeasonStore.getState().reset();
  useAnilistSearchStore.getState().reset();
  useBangumiSearchStore.getState().reset();
  useBangumiCalendarStore.getState().reset();
  useCollectionsStore.getState().reset();
  useIptvStore.getState().reset();
  useNextSeasonStore.getState().reset();
  useSearchHistoryStore.getState().reset();
  useSearchStore.getState().reset();
}
