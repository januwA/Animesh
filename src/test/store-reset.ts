import { useCalendarStore } from "@/presentation/store/calendarStore";
import { useCollectionsStore } from "@/presentation/store/collectionsStore";
import { useIptvStore } from "@/presentation/store/iptvStore";
import { useSearchStore } from "@/presentation/store/searchStore";

export function resetAppStores(): void {
  useCalendarStore.getState().reset();
  useCollectionsStore.getState().reset();
  useIptvStore.getState().reset();
  useSearchStore.getState().reset();
}
