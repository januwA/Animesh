import { useCollectionsStore } from "@/presentation/store/collectionsStore";
import { useSearchHistoryStore } from "@/presentation/store/searchHistoryStore";
import { useSearchStore } from "@/presentation/store/searchStore";

export function resetAppStores(): void {
  useCollectionsStore.getState().reset();
  useSearchHistoryStore.getState().reset();
  useSearchStore.getState().reset();
}
