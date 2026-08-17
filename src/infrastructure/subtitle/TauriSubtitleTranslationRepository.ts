import { invoke } from "@tauri-apps/api/core";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import {
  type SubtitleTranslationRecord,
  SubtitleTranslationRecordSchema,
} from "../../domain/subtitle/SubtitleTranslationSchemas";

export class TauriSubtitleTranslationRepository
  implements SubtitleTranslationRepository
{
  async getById(id: string): Promise<SubtitleTranslationRecord | null> {
    const raw = await invoke<unknown>("subtitle_translation_get", { id });
    if (raw === null) return null;
    const result = SubtitleTranslationRecordSchema.safeParse(raw);
    if (!result.success) {
      throw new Error("subtitle_translation_get 返回结构不匹配", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async listByTorrent(
    infoHash: string,
    fileId: number,
  ): Promise<SubtitleTranslationRecord[]> {
    const raw = await invoke<unknown>("subtitle_translation_list_by_torrent", {
      infoHash,
      fileId,
    });
    if (!Array.isArray(raw)) {
      throw new Error("subtitle_translation_list_by_torrent 返回非数组");
    }
    return raw.map((item, idx) => {
      const result = SubtitleTranslationRecordSchema.safeParse(item);
      if (!result.success) {
        throw new Error(
          `subtitle_translation_list_by_torrent 第 ${idx} 项结构不匹配`,
          { cause: result.error },
        );
      }
      return result.data;
    });
  }

  async save(record: SubtitleTranslationRecord): Promise<void> {
    await invoke<void>("subtitle_translation_save", { record });
  }

  async deleteById(id: string): Promise<boolean> {
    return invoke<boolean>("subtitle_translation_delete", { id });
  }

  async deleteByTorrent(infoHash: string, fileId: number): Promise<number> {
    return invoke<number>("subtitle_translation_delete_by_torrent", {
      infoHash,
      fileId,
    });
  }

  async deleteByInfoHash(infoHash: string): Promise<number> {
    return invoke<number>("subtitle_translation_delete_by_info_hash", {
      infoHash,
    });
  }
}
