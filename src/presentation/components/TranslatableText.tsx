import { Languages, Loader2 } from "lucide-react";
import type { TranslationProvider } from "@/domain/settings/SettingsSchemas";
import { Button } from "@/presentation/components/ui/button";
import { useTranslation } from "@/presentation/hooks/useTranslation";
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
}

export function TranslatableText({
  text,
  as: Tag = "p",
  className,
  toolbarClassName,
  sourceLang,
  targetLang,
  provider,
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

  const displayText = isTranslated && !showingOriginal ? translatedText : text;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-1 border-b border-border/50",
          toolbarClassName,
        )}
      >
        {loading ? (
          <Button
            variant="ghost"
            size="xs"
            disabled
            className="text-muted-foreground"
          >
            <Loader2 className="size-3 animate-spin" />
            <span>翻译中...</span>
          </Button>
        ) : isTranslated ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={toggle}
            className="text-muted-foreground hover:text-foreground"
          >
            <Languages className="size-3" />
            <span>{showingOriginal ? "查看翻译" : "查看原文"}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            onClick={translate}
            disabled={text.trim() === ""}
            className="text-muted-foreground hover:text-foreground"
          >
            <Languages className="size-3" />
            <span>翻译</span>
          </Button>
        )}

        {error && (
          <span className="text-xs text-destructive ml-1">{error.message}</span>
        )}
      </div>

      <Tag className={cn("m-0", className)}>{displayText}</Tag>
    </div>
  );
}
