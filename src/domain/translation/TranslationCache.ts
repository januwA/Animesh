import type { Context } from "ajanuw-context";

/**
 * 翻译缓存接口，用于缓存已翻译的文本，避免重复请求。
 * Key 由调用方根据 sourceLang + targetLang + text 生成。
 */
export interface TranslationCache {
  /**
   * 获取缓存的翻译结果
   * @param ctx 可取消的上下文
   * @param key 缓存键
   * @returns 缓存的翻译文本，未命中时返回 null
   */
  get(ctx: Context, key: string): Promise<string | null>;

  /**
   * 写入翻译结果到缓存
   * @param ctx 可取消的上下文
   * @param key 缓存键
   * @param value 翻译后的文本
   */
  set(ctx: Context, key: string, value: string): Promise<void>;
}
