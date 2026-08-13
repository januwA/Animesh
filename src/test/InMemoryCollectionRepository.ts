import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";

/**
 * 内存版 CollectionRepository Mock，供单元测试注入，避免接触真实后端。
 */
export class InMemoryCollectionRepository implements CollectionRepository {
  private items: FavoriteItem[] = [];

  async getAll(): Promise<FavoriteItem[]> {
    return [...this.items].sort((a, b) => b.addedAt - a.addedAt);
  }

  async isFavorited(subjectId: number): Promise<boolean> {
    return this.items.some((item) => item.subjectId === subjectId);
  }

  async add(item: Omit<FavoriteItem, "addedAt">): Promise<void> {
    if (this.items.some((i) => i.subjectId === item.subjectId)) {
      return;
    }
    this.items.push({ ...item, addedAt: Date.now() });
  }

  async remove(subjectId: number): Promise<void> {
    this.items = this.items.filter((item) => item.subjectId !== subjectId);
  }
}
