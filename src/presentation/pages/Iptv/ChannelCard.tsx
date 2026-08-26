import { Tv } from "lucide-react";
import type { IptvChannel } from "@/domain/iptv/IptvSchemas";
import { LazyImage } from "@/presentation/components/LazyImage";

interface ChannelCardProps {
  channel: IptvChannel;
  onClick: () => void;
}

export function ChannelCard({ channel, onClick }: ChannelCardProps) {
  return (
    <div className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-200 text-left">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col w-full text-left"
        title={`播放: ${channel.name}`}
      >
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {channel.logo ? (
            <LazyImage
              className="object-contain"
              src={channel.logo}
              alt={channel.name}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="h-8 w-8 text-primary/30" />
            </div>
          )}
        </div>
        <div className="p-2 flex flex-col gap-1 flex-1 min-w-0">
          <h3 className="text-xs font-medium leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {channel.name}
          </h3>
          {channel.category && (
            <span className="text-[10px] text-muted-foreground truncate">
              {channel.category}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
