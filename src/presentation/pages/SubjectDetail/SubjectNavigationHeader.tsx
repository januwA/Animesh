import { Globe } from "lucide-react";
import type { AddFavoriteUseCase } from "@/application/collection/AddFavoriteUseCase";
import type { GetFavoriteStatusUseCase } from "@/application/collection/GetFavoriteStatusUseCase";
import type { RemoveFavoriteUseCase } from "@/application/collection/RemoveFavoriteUseCase";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { BackButton } from "@/presentation/components/BackButton";
import { FavoriteButton } from "@/presentation/components/FavoriteButton";

export interface SubjectNavigationHeaderProps {
  subject: BangumiSubject | undefined;
  displayName: string;
  onBack: () => void;
  onOpenUrl: () => void;
  getFavoriteStatusUseCase: Pick<GetFavoriteStatusUseCase, "execute">;
  addFavoriteUseCase: Pick<AddFavoriteUseCase, "execute">;
  removeFavoriteUseCase: Pick<RemoveFavoriteUseCase, "execute">;
}

export function SubjectNavigationHeader({
  subject,
  displayName,
  onBack,
  onOpenUrl,
  getFavoriteStatusUseCase,
  addFavoriteUseCase,
  removeFavoriteUseCase,
}: SubjectNavigationHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <BackButton onBack={onBack} />

      <div className="flex items-center gap-1">
        {subject && (
          <FavoriteButton
            subject={{
              // v8 ignore start
              subjectId: subject.id,
              name: subject.name,
              imageUrl: subject.image,
              // v8 ignore stop
            }}
            showLabel={false}
            getFavoriteStatusUseCase={getFavoriteStatusUseCase}
            addFavoriteUseCase={addFavoriteUseCase}
            removeFavoriteUseCase={removeFavoriteUseCase}
          />
        )}
        {subject && (
          <a
            href={`https://bgm.tv/subject/${subject.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors px-2.5 py-1 rounded bg-secondary hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenUrl();
            }}
            title={`在 Bangumi 打开: ${displayName}`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>详情</span>
          </a>
        )}
      </div>
    </div>
  );
}
