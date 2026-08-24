import { Tv } from "lucide-react";
import type { AnimeCharacter } from "@/domain/anime/AnimeSchemas";
import { LazyImage } from "@/presentation/components/LazyImage";

export interface CharacterCardProps {
  character: AnimeCharacter;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const mainActor = character.actors[0];

  const tvFallback = (
    <div className="w-full h-full flex items-center justify-center">
      <Tv className="h-8 w-8 text-muted-foreground/40" />
    </div>
  );

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
      {/* Character portrait */}
      <div className="relative aspect-3/4 bg-linear-to-b from-muted/50 to-muted overflow-hidden">
        <LazyImage
          src={character.image}
          alt={character.name}
          className="object-contain p-1 transition-transform duration-300 group-hover:scale-105"
          fallback={tvFallback}
        />
        {/* Relation badge overlay */}
        {character.relation && (
          <span
            className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded-full border`}
          >
            {character.relation} {/* style-ignore */}
          </span>
        )}
      </div>

      {/* Character info */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-1">
          {character.name}
        </h3>

        {/* Voice actor */}
        {mainActor && (
          <div className="mt-auto pt-2 border-t border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground leading-tight">
              CV: {mainActor.name}
            </p>
          </div>
        )}

        {/* Extra actors count */}
        {character.actors.length > 1 && (
          <p className="text-[10px] text-muted-foreground">
            +{character.actors.length - 1} 位声优
          </p>
        )}
      </div>
    </div>
  );
}
