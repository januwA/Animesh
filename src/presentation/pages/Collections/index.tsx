import { Heart } from "lucide-react";
import { useState } from "react";
import { useDI } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { MediaCard } from "@/presentation/components/MediaCard";
import { Badge } from "@/presentation/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { useCollectionsPage } from "./useCollectionsPage";

const platformLabels: Record<AnimePlatform | "all", string> = {
  all: "全部",
  bangumi: "Bangumi",
  anilist: "Anilist",
};

export default function Collections() {
  const { getCollectionsUseCase } = useDI();
  const { items, handleItemClick } = useCollectionsPage({
    getCollectionsUseCase,
  });
  const [activePlatform, setActivePlatform] = useState<AnimePlatform | "all">(
    "all",
  );

  const filteredItems =
    activePlatform === "all"
      ? items
      : items.filter((item) => item.platform === activePlatform);

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-red-500 fill-current" />
        <h1 className="text-lg font-bold text-foreground">我的收藏</h1>
        {items.length > 0 && (
          <Badge
            variant="secondary"
            className="text-xs border-border text-muted-foreground"
          >
            {items.length}
          </Badge>
        )}
      </div>

      {items.length > 0 ? (
        <Tabs
          value={activePlatform}
          onValueChange={(v) => setActivePlatform(v as AnimePlatform | "all")}
        >
          <TabsList>
            <TabsTrigger value="all">
              {platformLabels.all}
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {items.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="bangumi">
              {platformLabels.bangumi}
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {items.filter((i) => i.platform === "bangumi").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="anilist">
              {platformLabels.anilist}
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {items.filter((i) => i.platform === "anilist").length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activePlatform} className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredItems.map((item) => (
                <MediaCard
                  key={`${item.platform}-${item.subjectId}`}
                  id={item.subjectId}
                  imageSrc={item.imageUrl}
                  title={item.name}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <Empty>
          <EmptyContent>
            <EmptyTitle>还没有收藏任何条目</EmptyTitle>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
