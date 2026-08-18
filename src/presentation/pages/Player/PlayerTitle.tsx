import type { NonEmptyString } from "@/domain/common/NonEmptyString";

export interface PlayerTitleProps {
  fileName: NonEmptyString;
  title: NonEmptyString;
}

export function PlayerTitle({ fileName, title }: PlayerTitleProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1
        className="text-xl sm:text-2xl font-bold text-foreground wrap-break-word"
        title={fileName}
      >
        {fileName}
      </h1>
      <p className="text-sm text-muted-foreground">来自种子: {title}</p>
    </div>
  );
}
