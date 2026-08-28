import type { Context } from "ajanuw-context";
import type { TranslationService } from "@/domain/translation/TranslationService";

/**
 * 基于 Google Translate 免费 API 的翻译实现。
 * 使用 GET 请求，无需 API Key。
 *
 * 端点: https://translate.googleapis.com/translate_a/single
 */
export class GoogleTranslateClient implements TranslationService {
  private static readonly ENDPOINT =
    "https://translate.googleapis.com/translate_a/single";

  async translate(
    ctx: Context,
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    const controller = new AbortController();
    ctx.done().then(() => controller.abort());

    const params = new URLSearchParams({
      client: "gtx",
      sl: sourceLang,
      tl: targetLang,
      dt: "t",
      q: text,
    });

    const url = `${GoogleTranslateClient.ENDPOINT}?${params.toString()}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(
        `Google Translate 请求失败: ${response.status} ${response.statusText}`,
      );
    }

    // Google Translate 返回嵌套数组格式: [[["translated","original",...], ...], ...]
    const data: unknown = await response.json();
    return this.extractTranslation(data);
  }

  private extractTranslation(data: unknown): string {
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error("Google Translate 返回格式异常");
    }

    const sentences: string[] = [];
    for (const segment of data[0]) {
      if (Array.isArray(segment) && typeof segment[0] === "string") {
        sentences.push(segment[0]);
      }
    }

    return sentences.join("");
  }
}
