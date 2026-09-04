import { Languages, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { TranslationProvider } from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import { useTranslation } from "@/presentation/hooks/useTranslation";
import { sanitizeHtml } from "@/presentation/lib/sanitizeHtml";
import { cn } from "@/presentation/lib/utils";

export interface TranslatableTextProps {
  /** 待翻译的原始文本 */
  text: string;
  /** 渲染的 HTML 标签 */
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** 额外的 CSS 类名 */
  className?: string;
  /** 工具栏的额外 CSS 类名 */
  toolbarClassName?: string;
  /** 源语言代码 */
  sourceLang?: string;
  /** 目标语言代码 */
  targetLang?: string;
  /** 翻译提供者 */
  provider?: TranslationProvider;
  /**
   * 开启后把 text 视为 HTML 源码，原文与译文均在渲染前经 sanitizeHtml 净化。
   */
  renderHtml?: boolean;
}

export function TranslatableText({
  text,
  as: Tag = "p",
  className,
  toolbarClassName,
  sourceLang,
  targetLang,
  provider,
  renderHtml = false,
}: TranslatableTextProps) {
  const {
    translatedText,
    loading,
    error,
    isTranslated,
    translate,
    toggle,
    showingOriginal,
  } = useTranslation(text, { sourceLang, targetLang, provider });

  // v8 ignore next
  const displayText =
    isTranslated && !showingOriginal ? (translatedText ?? text) : text;

  // 用 useMemo 缓存净化后的 HTML 对象：displayText 不变时引用稳定，
  // 避免父层无关重渲染导致 React 每次都重写 dangerouslySetInnerHTML 内容（闪烁）。
  // 仅在 renderHtml 开启时才进行净化，纯文本模式不调用 sanitizeHtml。
  const sanitizedHtml = useMemo(
    () => (renderHtml ? { __html: sanitizeHtml(displayText) } : null),
    [displayText, renderHtml],
  );

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-1 border-b border-border/50",
          toolbarClassName,
        )}
      >
        {loading ? (
          <Button variant="ghost" size="xs" disabled>
            <Loader2 className="size-3 animate-spin" />
            翻译中...
          </Button>
        ) : isTranslated ? (
          <Button variant="ghost" size="xs" onClick={toggle}>
            <Languages className="size-3" />
            {showingOriginal ? "查看翻译" : "查看原文"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            onClick={translate}
            disabled={text.trim() === ""}
          >
            <Languages className="size-3" />
            翻译
          </Button>
        )}

        {error && (
          <span className="text-xs text-destructive ml-1">{error.message}</span>
        )}
      </div>

      <Tag
        className={cn("m-0", className)}
        {...(renderHtml && sanitizedHtml
          ? { dangerouslySetInnerHTML: sanitizedHtml }
          : { children: displayText })}
      />
    </div>
  );
}
