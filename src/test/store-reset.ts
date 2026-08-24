import { useAnilistCalendarStore } from "@/presentation/store/anilistCalendarStore";
import { useBangumiSearchStore } from "@/presentation/store/bangumiSearchStore";
import { useCalendarStore } from "@/presentation/store/calendarStore";
import { useCollectionsStore } from "@/presentation/store/collectionsStore";
import { useIptvStore } from "@/presentation/store/iptvStore";
import { useSearchStore } from "@/presentation/store/searchStore";

export function resetAppStores(): void {
  useAnilistCalendarStore.getState().reset();
  useBangumiSearchStore.getState().reset();
  useCalendarStore.getState().reset();
  useCollectionsStore.getState().reset();
  useIptvStore.getState().reset();
  useSearchStore.getState().reset();
}
