import { Background, WithCancel } from "ajanuw-context";
import { Search, Tv } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { IptvChannel, IptvCountry } from "@/domain/iptv/IptvSchemas";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Input } from "@/presentation/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/presentation/components/ui/select";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/presentation/components/ui/toggle-group";
import { formatError } from "@/utils";
import { ErrorBanner } from "../components/AppComponents";
import { LazyImage } from "../components/LazyImage";

const DEFAULT_COUNTRY = "CN";
const DEFAULT_COUNTRY_FALLBACK: IptvCountry = {
	name: "中国",
	code: "CN",
	flag: "🇨🇳",
};
const ALL_CATEGORY = "all";
const ALL_CATEGORY_LABEL = "全部";

interface ChannelCardProps {
	channel: IptvChannel;
	onClick: () => void;
}

function ChannelCard({ channel, onClick }: ChannelCardProps) {
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

export default function Iptv() {
	const navigate = useNavigate();
	const { getIptvCountriesUseCase, getIptvChannelsUseCase, logger } = useDI();
	const iptvLogger = useMemo(() => logger.withCategory("Iptv"), [logger]);

	const [countries, setCountries] = useState<IptvCountry[]>([]);
	const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
	const [channels, setChannels] = useState<IptvChannel[]>([]);
	const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
	const [keyword, setKeyword] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const [ctx, cancel] = WithCancel(Background);

		(async () => {
			try {
				const data = await getIptvCountriesUseCase.execute(ctx);
				if (!ctx.err()) {
					setCountries(data);
				}
			} catch (err: unknown) {
				if (!ctx.err()) {
					iptvLogger.warn("Failed to fetch IPTV countries:", err);
				}
			}
		})();

		return () => {
			cancel();
		};
	}, [getIptvCountriesUseCase, iptvLogger]);

	useEffect(() => {
		setChannels([]);
		setSelectedCategory(ALL_CATEGORY);
		setError(null);
		setIsLoading(true);
		const [ctx, cancel] = WithCancel(Background);

		(async () => {
			try {
				const data = await getIptvChannelsUseCase.execute(ctx, selectedCountry);
				if (!ctx.err()) {
					setChannels(data);
				}
			} catch (err: unknown) {
				if (!ctx.err()) {
					setError(`获取频道列表失败，请检查网络或重试: ${formatError(err)}`);
				}
			} finally {
				if (!ctx.err()) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			cancel();
		};
	}, [getIptvChannelsUseCase, selectedCountry]);

	const selectCountries = useMemo(() => {
		if (countries.some((country) => country.code === selectedCountry)) {
			return countries;
		}
		return [DEFAULT_COUNTRY_FALLBACK, ...countries];
	}, [countries, selectedCountry]);

	const categories = useMemo(() => {
		const categorySet = new Set<string>();
		for (const channel of channels) {
			if (channel.category) {
				categorySet.add(channel.category);
			}
		}
		return Array.from(categorySet).sort();
	}, [channels]);

	const filteredChannels = useMemo(() => {
		const normalizedKeyword = keyword.trim().toLowerCase();
		return channels.filter((channel) => {
			if (
				selectedCategory !== ALL_CATEGORY &&
				channel.category !== selectedCategory
			) {
				return false;
			}
			if (!normalizedKeyword) {
				return true;
			}
			return (
				channel.name.toLowerCase().includes(normalizedKeyword) ||
				(channel.tvgId ?? "").toLowerCase().includes(normalizedKeyword) ||
				(channel.category ?? "").toLowerCase().includes(normalizedKeyword)
			);
		});
	}, [channels, selectedCategory, keyword]);

	const handleCountryChange = (value: string) => {
		setSelectedCountry(value);
	};

	const handleCategoryChange = (value: string) => {
		setSelectedCategory(value || ALL_CATEGORY);
	};

	const handleChannelClick = (channel: IptvChannel) => {
		const params = new URLSearchParams({
			url: channel.url,
			name: channel.name,
			logo: channel.logo ?? "",
			category: channel.category ?? "",
		});
		navigate(`/live/play?${params.toString()}`);
	};

	return (
		<div className="w-full flex flex-col gap-4">
			<div className="flex flex-col gap-3">
				<div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
					<Select value={selectedCountry} onValueChange={handleCountryChange}>
						<SelectTrigger className="w-full sm:w-56 h-10">
							<SelectValue placeholder="选择国家" />
						</SelectTrigger>
						<SelectContent>
							{selectCountries.map((country) => (
								<SelectItem key={country.code} value={country.code}>
									{country.flag} {country.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							placeholder="搜索频道..."
							className="pl-9"
						/>
					</div>
				</div>

				<div className="overflow-x-auto -mx-4 px-4">
					<ToggleGroup
						type="single"
						value={selectedCategory}
						onValueChange={handleCategoryChange}
						variant="outline"
						size="sm"
					>
						<ToggleGroupItem value={ALL_CATEGORY}>
							{ALL_CATEGORY_LABEL}
						</ToggleGroupItem>
						{categories.map((category) => (
							<ToggleGroupItem key={category} value={category}>
								{category}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			</div>

			{!isLoading && !error && (
				<p className="text-xs text-muted-foreground">
					共 {filteredChannels.length} 个频道
				</p>
			)}

			{isLoading && (
				<Card className="bg-card border-border py-20">
					<CardContent className="flex flex-col items-center justify-center gap-4">
						<Skeleton className="h-10 w-10 rounded-full" />
						<Skeleton className="h-4 w-40" />
					</CardContent>
				</Card>
			)}

			{error && <ErrorBanner message={error} />}

			{!isLoading && !error && channels.length === 0 && (
				<Empty>
					<EmptyContent>
						<EmptyTitle>该国家暂无频道</EmptyTitle>
						<EmptyDescription>请尝试切换其他国家</EmptyDescription>
					</EmptyContent>
				</Empty>
			)}

			{!isLoading &&
				!error &&
				channels.length > 0 &&
				filteredChannels.length === 0 && (
					<Empty>
						<EmptyContent>
							<EmptyTitle>没有符合筛选条件的频道</EmptyTitle>
							<EmptyDescription>请尝试其他关键词或分类</EmptyDescription>
						</EmptyContent>
					</Empty>
				)}

			{!isLoading && !error && filteredChannels.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
					{filteredChannels.map((channel) => (
						<ChannelCard
							key={channel.url}
							channel={channel}
							onClick={() => handleChannelClick(channel)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
