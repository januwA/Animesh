import { Background, WithCancel } from "ajanuw-context";
import {
	ArrowLeft,
	Calendar,
	ChevronDown,
	ChevronUp,
	Clock,
	Globe,
	Loader2,
	Star,
	Tv,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type {
	BangumiCharacter,
	BangumiEpisode,
	BangumiPerson,
	BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
import { LazyImage } from "@/presentation/components/LazyImage";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { formatError } from "@/utils";
import { ErrorBanner } from "../components/AppComponents";

/** Deduplicate staff by (id, relation), then group by person ID to collect all roles. */
function consolidateStaff(persons: BangumiPerson[]) {
	const seen = new Set<string>();
	const personMap = new Map<
		number,
		{
			id: number;
			name: string;
			image: string;
			relations: string[];
			eps: string;
		}
	>();

	for (const p of persons) {
		const key = `${p.id}|${p.relation}`;
		if (seen.has(key)) continue;
		seen.add(key);

		const entry = personMap.get(p.id);
		if (entry) {
			entry.relations.push(p.relation);
		} else {
			const image =
				p.images.large ||
				p.images.medium ||
				p.images.small ||
				p.images.grid ||
				"";
			personMap.set(p.id, {
				id: p.id,
				name: p.name,
				image,
				relations: [p.relation],
				eps: p.eps,
			});
		}
	}
	return Array.from(personMap.values());
}

function CharacterCard({ character }: { character: BangumiCharacter }) {
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
					src={character.images.large}
					alt={character.name}
					className="object-contain p-1 transition-transform duration-300 group-hover:scale-105"
					fallback={tvFallback}
				/>
				{/* Relation badge overlay */}
				{character.relation && (
					<span
						className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${character.relation === "主角" ? "bg-amber-500/90 text-white border-amber-400" : "bg-card/90 text-muted-foreground border-border"}`}
					>
						{character.relation} {/* style-ignore */}
					</span>
				)}
			</div>

			{/* Character info */}
			<div className="p-3 space-y-2 flex-1 flex flex-col">
				<h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-1">
					{character.name}
				</h3>

				{/* Voice actor */}
				{mainActor && (
					<div className="mt-auto pt-2 border-t border-border/50">
						<p className="text-[11px] font-medium text-muted-foreground leading-tight truncate">
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

function StaffPersonBadge({
	person,
}: {
	person: ReturnType<typeof consolidateStaff>[number];
}) {
	return (
		<div className="px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/50 text-sm transition-colors hover:bg-secondary">
			<span className="text-xs font-medium text-foreground">{person.name}</span>
			{person.eps && (
				<span className="text-[10px] text-muted-foreground">
					({person.eps})
				</span>
			)}
		</div>
	);
}

function CharactersSkeleton() {
	return (
		<div className="flex overflow-x-auto gap-3 pb-2">
			{[0, 1, 2, 3, 4].map((n) => (
				<div
					key={n}
					className="shrink-0 w-36 flex flex-col rounded-xl border border-border overflow-hidden"
				>
					<Skeleton className="aspect-3/4 rounded-none" />
					<div className="p-3 space-y-2">
						<Skeleton className="h-4 w-3/4" />
						<div className="flex items-center gap-2 pt-2 border-t border-border/50">
							<Skeleton className="h-6 w-6 rounded-full" />
							<Skeleton className="h-3 w-2/3" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

function StaffSkeleton() {
	return (
		<div className="space-y-4">
			{[0, 1, 2, 3].map((n) => (
				<div key={n} className="space-y-2">
					<Skeleton className="h-4 w-24" />
					<div className="flex flex-wrap gap-2">
						{[0, 1, 2].map((n) => (
							<Skeleton key={n} className="h-7 w-20 rounded-lg" />
						))}
					</div>
				</div>
			))}
		</div>
	);
}

export default function SubjectDetail() {
	const { subjectId } = useParams<{ subjectId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const state = location.state as { name?: string; imageUrl?: string } | null;
	const {
		getBangumiSubjectUseCase,
		getBangumiEpisodesUseCase,
		getBangumiPersonsUseCase,
		getBangumiCharactersUseCase,
		openUrlUseCase,
	} = useDI();

	const [subject, setSubject] = useState<BangumiSubject | null>(null);
	const [episodes, setEpisodes] = useState<BangumiEpisode[]>([]);
	const [persons, setPersons] = useState<BangumiPerson[]>([]);
	const [characters, setCharacters] = useState<BangumiCharacter[]>([]);
	const [error, setError] = useState<string | null>(null);

	const [summaryExpanded, setSummaryExpanded] = useState(false);
	const [summaryHasMore, setSummaryHasMore] = useState(false);
	const summaryRef = useRef<HTMLParagraphElement>(null);

	const [charactersLoading, setCharactersLoading] = useState(true);
	const [personsLoading, setPersonsLoading] = useState(true);

	// Reset summary expansion state when subject changes
	useEffect(() => {
		if (subject?.id !== undefined) {
			setSummaryExpanded(false);
			setSummaryHasMore(false);
		} else {
			setSummaryExpanded(false);
			setSummaryHasMore(false);
		}
	}, [subject?.id]);

	// Check if summary overflows when collapsed
	useEffect(() => {
		const element = summaryRef.current;
		if (!element) return;

		void subject?.summary;

		if (!summaryExpanded) {
			const hasOverflow = element.scrollHeight > element.clientHeight;
			setSummaryHasMore(hasOverflow);
		}
	}, [subject?.summary, summaryExpanded]);

	const todayStr = useMemo(() => {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, "0");
		const day = String(today.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}, []);

	useEffect(() => {
		if (!subjectId) return;

		setSubject(null);
		setEpisodes([]);
		setPersons([]);
		setCharacters([]);
		setError(null);
		setCharactersLoading(true);
		setPersonsLoading(true);
		const [ctx, cancel] = WithCancel(Background);

		const fetchData = async () => {
			try {
				const [subjectData, episodesData] = await Promise.all([
					getBangumiSubjectUseCase.execute(ctx, subjectId),
					getBangumiEpisodesUseCase.execute(ctx, subjectId),
				]);

				if (!ctx.err()) {
					setSubject(subjectData);
					const sortedEps = [...episodesData].sort((a, b) => a.sort - b.sort);
					setEpisodes(sortedEps);
				}
			} catch (err: unknown) {
				if (!ctx.err()) {
					setError(`获取动漫详情失败: ${formatError(err)}`);
				}
			}
		};

		const fetchCharacters = async () => {
			try {
				const data = await getBangumiCharactersUseCase.execute(ctx, subjectId);
				if (!ctx.err()) {
					setCharacters(data);
				}
			} catch {
				// Characters are non-critical
			} finally {
				if (!ctx.err()) {
					setCharactersLoading(false);
				}
			}
		};

		const fetchPersons = async () => {
			try {
				const data = await getBangumiPersonsUseCase.execute(ctx, subjectId);
				if (!ctx.err()) {
					setPersons(data);
				}
			} catch {
				// Persons are non-critical
			} finally {
				if (!ctx.err()) {
					setPersonsLoading(false);
				}
			}
		};

		fetchData();
		fetchCharacters();
		fetchPersons();

		return () => {
			cancel();
		};
	}, [
		subjectId,
		getBangumiSubjectUseCase,
		getBangumiEpisodesUseCase,
		getBangumiPersonsUseCase,
		getBangumiCharactersUseCase,
	]);

	const handleEpisodeClick = (episode: BangumiEpisode) => {
		/* v8 ignore next */
		if (!subject) return;
		const name = subject.name_cn || subject.name;
		const epNum = String(episode.sort).padStart(2, "0");
		navigate(`/?keyword=${encodeURIComponent(`${name} ${epNum}`)}`);
	};

	const handleBack = () => {
		if (document.startViewTransition) {
			document.startViewTransition(() => {
				navigate(-1);
			});
		} else {
			navigate(-1);
		}
	};

	const consolidatedStaff = useMemo(
		() => (persons.length > 0 ? consolidateStaff(persons) : []),
		[persons],
	);

	const staffGroupedByRole = useMemo(() => {
		const groups = new Map<string, typeof consolidatedStaff>();
		for (const person of consolidatedStaff) {
			for (const relation of person.relations) {
				const list = groups.get(relation) || [];
				list.push(person);
				groups.set(relation, list);
			}
		}
		return groups;
	}, [consolidatedStaff]);

	if (error) {
		return (
			<div className="space-y-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBack}
					className="gap-2 text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					返回日历
				</Button>
				<ErrorBanner message={error} />
			</div>
		);
	}

	const displayName =
		subject?.name_cn || subject?.name || state?.name || "加载中...";
	const originalName = subject
		? subject.name !== displayName
			? subject.name
			: ""
		: "";
	const imageUrl = subject?.images?.large || state?.imageUrl;

	return (
		<div className="w-full space-y-6 animate-in fade-in duration-300">
			{/* Navigation Header */}
			<div className="flex items-center justify-between">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBack}
					className="gap-2 text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					返回日历
				</Button>

				{subject && (
					<a
						href={`https://bgm.tv/subject/${subject.id}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors px-2.5 py-1 rounded bg-secondary hover:bg-accent"
						onClick={async (e) => {
							e.stopPropagation();
							e.preventDefault();
							const url = `https://bgm.tv/subject/${subject.id}`;
							await openUrlUseCase.execute(url);
						}}
						title={`在 Bangumi 打开: ${displayName}`}
					>
						<Globe className="h-3.5 w-3.5" />
						<span>详情</span>
					</a>
				)}
			</div>

			{/* Info Header Card */}
			<div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
				{/* Poster Image */}
				<div className="w-full md:w-48 shrink-0 flex justify-center">
					{imageUrl ? (
						<img
							src={imageUrl}
							alt={displayName}
							style={
								{
									viewTransitionName: `anime-cover-${subjectId}`,
								} as React.CSSProperties
							}
							className="w-48 aspect-3/4 object-cover rounded-xl shadow-lg border border-border"
						/>
					) : (
						<div className="w-48 aspect-3/4 rounded-xl bg-muted flex items-center justify-center border border-border">
							<Tv className="h-12 w-12 text-muted-foreground" />
						</div>
					)}
				</div>

				{/* Title and Metadata */}
				<div className="flex-1 flex flex-col justify-between space-y-4">
					<div className="space-y-2">
						{subject ? (
							<div className="flex flex-wrap items-center gap-2">
								{subject.platform && (
									<Badge
										variant="secondary"
										className="gap-1 bg-secondary border border-border text-muted-foreground"
									>
										<Tv className="h-3 w-3" />
										{subject.platform}
									</Badge>
								)}
								{subject.date && (
									<Badge
										variant="secondary"
										className="gap-1 bg-secondary border border-border text-muted-foreground"
									>
										<Calendar className="h-3 w-3" />
										{subject.date}
									</Badge>
								)}
								{subject.eps !== undefined && subject.eps !== null && (
									<Badge
										variant="secondary"
										className="gap-1 bg-secondary border border-border text-muted-foreground"
									>
										<Clock className="h-3 w-3" />共 {subject.eps} 话
									</Badge>
								)}
							</div>
						) : (
							<div className="flex flex-wrap items-center gap-2">
								<Skeleton className="h-5 w-16 rounded-full" />
								<Skeleton className="h-5 w-24 rounded-full" />
								<Skeleton className="h-5 w-16 rounded-full" />
							</div>
						)}

						<h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
							{displayName}
						</h1>
						{originalName && (
							<p className="text-sm md:text-base text-muted-foreground italic font-normal">
								{originalName}
							</p>
						)}
					</div>

					{/* Ratings / Stats / Loading Status */}
					{subject ? (
						<div className="flex flex-wrap gap-6 items-center pt-2">
							{subject.rating && (
								<div className="flex items-center gap-2">
									<div className="flex items-center justify-center h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
										{" "}
										{/* style-ignore */}
										<Star className="h-6 w-6 fill-current" />
									</div>
									<div>
										<div className="text-xl font-bold text-amber-500">
											{subject.rating.score.toFixed(1)}
										</div>
										<div className="text-xs text-muted-foreground">
											{subject.rating.total?.toLocaleString() ?? 0} 人评分
										</div>
									</div>
								</div>
							)}

							{subject.rating?.rank ? (
								<div className="flex items-center gap-2">
									<div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary border border-primary/20">
										<Tv className="h-6 w-6" />
									</div>
									<div>
										<div className="text-xl font-bold text-primary">
											Rank #{subject.rating.rank}
										</div>
										<div className="text-xs text-muted-foreground">
											Bangumi 排名
										</div>
									</div>
								</div>
							) : null}

							{subject.collection?.doing != null && (
								<div className="flex items-center gap-2">
									<div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
										{" "}
										{/* style-ignore */}
										<Users className="h-6 w-6" />
									</div>
									<div>
										<div className="text-xl font-bold text-green-500">
											{subject.collection.doing.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">人在看</div>
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="space-y-3 pt-2">
							<div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
								<Loader2 className="h-4 w-4 text-primary animate-spin" />
								<span>正在加载动漫详情...</span>
							</div>
							<div className="flex gap-4">
								<Skeleton className="h-20 w-28 rounded-lg" />
								<Skeleton className="h-20 w-28 rounded-lg" />
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Synopsis / Summary */}
			{subject ? (
				subject.summary && (
					<Card className="bg-card border border-border rounded-xl">
						<CardContent className="p-6 space-y-2 relative overflow-hidden">
							<h2 className="text-sm font-semibold text-muted-foreground">
								剧情简介
							</h2>
							<div className="relative">
								<p
									ref={summaryRef}
									className={`text-sm text-foreground leading-relaxed whitespace-pre-wrap transition-all duration-300 ${
										!summaryExpanded ? "line-clamp-4" : ""
									}`}
								>
									{subject.summary}
								</p>

								{/* Gradient Mask for fade-out effect when collapsed and there's overflow */}
								{!summaryExpanded && summaryHasMore && (
									<div
										className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
										style={{
											background:
												"linear-gradient(to top, hsl(var(--card)) 0%, hsl(var(--card) / 0.6) 50%, transparent 100%)",
										}}
									/>
								)}
							</div>

							{summaryHasMore && (
								<div className="flex justify-center pt-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setSummaryExpanded(!summaryExpanded)}
										className="h-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-secondary hover:bg-accent px-3 rounded-lg transition-colors"
									>
										{summaryExpanded ? (
											<>
												<span>收起</span>
												<ChevronUp className="h-3.5 w-3.5" />
											</>
										) : (
											<>
												<span>展开</span>
												<ChevronDown className="h-3.5 w-3.5" />
											</>
										)}
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				)
			) : (
				<Card className="bg-card border border-border rounded-xl">
					<CardContent className="p-6 space-y-2">
						<Skeleton className="h-4 w-20" />
						<div className="space-y-2">
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-5/6" />
							<Skeleton className="h-3 w-4/5" />
						</div>
					</CardContent>
				</Card>
			)}

			{/* Characters Section */}
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<h2 className="text-lg font-bold text-foreground">角色</h2>
					{characters.length > 0 && (
						<Badge
							variant="secondary"
							className="text-xs border-border text-muted-foreground"
						>
							{characters.length}
						</Badge>
					)}
				</div>

				{charactersLoading ? (
					<CharactersSkeleton />
				) : characters.length > 0 ? (
					<div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent -mx-1 px-1">
						{characters.map((char) => (
							<div key={char.id} className="snap-start shrink-0 w-36">
								<CharacterCard character={char} />
							</div>
						))}
					</div>
				) : (
					<div className="text-center py-8 text-sm text-muted-foreground bg-card border border-border rounded-xl">
						暂无角色数据
					</div>
				)}
			</div>

			{/* Episodes List */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-bold text-foreground">剧集列表</h2>
					{subject && (
						<Badge
							variant="outline"
							className="text-xs border-border text-muted-foreground"
						>
							点击剧集卡片搜索种子资源
						</Badge>
					)}
				</div>

				{subject ? (
					episodes.length > 0 ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
							{episodes.map((ep) => {
								const isAired = ep.airdate ? todayStr >= ep.airdate : false;
								return (
									<button
										key={ep.id}
										type="button"
										onClick={() => handleEpisodeClick(ep)}
										className={`group text-left flex items-start gap-3 p-3 rounded-xl transition-all duration-200 ${
											isAired
												? "bg-primary/5 border border-primary/20 hover:border-primary/30 hover:bg-primary/10"
												: "bg-card border border-border hover:border-primary/30 hover:bg-muted/30"
										}`}
									>
										{/* Ep Number / Icon */}
										<div
											className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
												isAired
													? "bg-primary/15 group-hover:bg-primary/25"
													: "bg-muted group-hover:bg-primary/10"
											}`}
										>
											<span
												className={`text-sm font-bold transition-colors ${
													isAired
														? "text-primary"
														: "text-muted-foreground group-hover:text-primary"
												}`}
											>
												{String(ep.sort).padStart(2, "0")}
											</span>
										</div>

										{/* Ep Details */}
										<div className="flex-1 min-w-0 space-y-1">
											<div className="flex items-center gap-1.5 justify-between">
												<h3 className="text-sm font-medium leading-tight text-foreground group-hover:text-primary transition-colors">
													{ep.name_cn || ep.name}
												</h3>
											</div>
											<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
												{ep.duration && <span>时长 {ep.duration}</span>}
												{ep.airdate && <span>首播 {ep.airdate}</span>}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="text-center py-12 text-sm text-muted-foreground bg-card border border-border rounded-xl">
							暂无剧集数据
						</div>
					)
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
						{[1, 2, 3, 4, 5, 6].map((n) => (
							<Skeleton key={n} className="h-16 rounded-xl" />
						))}
					</div>
				)}
			</div>

			{/* Staff Section */}
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<h2 className="text-lg font-bold text-foreground">制作人员</h2>
					{persons.length > 0 && (
						<Badge
							variant="secondary"
							className="text-xs border-border text-muted-foreground"
						>
							{consolidatedStaff.length}
						</Badge>
					)}
				</div>

				{personsLoading ? (
					<StaffSkeleton />
				) : staffGroupedByRole.size > 0 ? (
					<div className="space-y-5">
						{Array.from(staffGroupedByRole.entries()).map(([role, people]) => (
							<div key={role} className="space-y-2">
								<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									{role}
									<span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
										{people.length}
									</span>
								</h3>
								<div className="flex flex-wrap gap-1.5">
									{people.map((person) => (
										<StaffPersonBadge
											key={`${person.id}-${role}`}
											person={person}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="text-center py-8 text-sm text-muted-foreground bg-card border border-border rounded-xl">
						暂无制作人员数据
					</div>
				)}
			</div>
		</div>
	);
}
