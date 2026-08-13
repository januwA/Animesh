import { useCalendarStore } from "@/presentation/store/calendarStore";
import { useIptvStore } from "@/presentation/store/iptvStore";
import { useSearchStore } from "@/presentation/store/searchStore";

export function resetAppStores(): void {
  useCalendarStore.getState().reset();
  useIptvStore.getState().reset();
  useSearchStore.getState().reset();
}
