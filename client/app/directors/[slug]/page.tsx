"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import Navbar from "@/components/Navbar";
import WorkModal from "@/components/works/WorkModal";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Block, BlockContentItem, getDirectorBlocks } from "@/lib/blocks";
import { getApiUrl } from "@/lib/utils";

// Lazy load components
const ScrollProgress = dynamic(() => import("@/components/ScrollProgress"), {
	ssr: false,
});
const MouseTrail = dynamic(() => import("@/components/MouseTrail"), {
	ssr: false,
});
const DropdownMenu = dynamic(() => import("@/components/DropdownMenu"), {
	ssr: false,
});

interface Work {
	id: number;
	title: string;
	slug: string;
	shortDescription?: string;
	subtitle?: string;
	caseStudy?: string;
	client?: string;
	agency?: string;
	videoUrl?: string;
	videoUrl720p?: string;
	previewVideoUrl?: string;
	hlsUrl?: string;
	optimizedVideoUrl?: string;
	images?: {
		thumbnail: string;
		small: string;
		medium: string;
		large: string;
		original: string;
	} | null;
	starrings?: Array<{
		title: string;
		slug: string;
	}>;
}

interface DirectorWork {
	sortOrder: number;
	work: Work;
}

interface HeroVideo {
	videoUrl?: string | null;
	videoUrl720p?: string | null;
	hlsUrl?: string | null;
	clipUrl?: string | null;
	clipThumbnailUrl?: string | null;
	clipStatus?: string | null;
}

interface Director {
	id: number;
	title: string;
	slug: string;
	shortDescription?: string;
	biography?: string;
	links?: Array<{ title: string; url: string }>;
	avatar?: {
		thumbnail: string;
		small: string;
		medium: string;
		large: string;
		original: string;
	} | null;
	heroVideo?: HeroVideo | null;
	heroWork?: Work | null;
	works?: DirectorWork[];
	createdAt: string;
	publishedAt: string;
}

interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

function DirectorContent() {
	const params = useParams();
	const slug = params?.slug as string;
	const [director, setDirector] = useState<Director | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [errorType, setErrorType] = useState<"director" | null>(null);
	const [selectedWork, setSelectedWork] = useState<any | null>(null);
	const [selectedCardRect, setSelectedCardRect] = useState<CardRect | null>(null);

	// Block-based works grid
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [blocksPage, setBlocksPage] = useState(1);
	const [hasMoreBlocks, setHasMoreBlocks] = useState(true);
	const [blocksLoading, setBlocksLoading] = useState(false);
	const observerTarget = useRef<HTMLDivElement>(null);
	const BLOCKS_LIMIT = 5;

	// Fetch director data
	useEffect(() => {
		if (!slug) return;

		const fetchDirector = async () => {
			try {
				const res = await fetch(`${getApiUrl()}/api/public/directors/${slug}`, {
					cache: "no-store",
				});

				if (!res.ok) {
					setError("Director not found");
					setErrorType("director");
					setLoading(false);
					return;
				}

				const directorData = await res.json();
				setDirector(directorData);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load director");
				console.error("Director fetch error:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchDirector();
	}, [slug]);

	// Fetch blocks for the director (infinite scroll)
	useEffect(() => {
		if (!slug) return; // Skip blocks for presentation mode
		const fetchBlocks = async () => {
			setBlocksLoading(true);
			try {
				const result = await getDirectorBlocks(slug, { page: blocksPage, limit: BLOCKS_LIMIT });
				if (result) {
					if (result.pagination.page >= result.pagination.totalPages) {
						setHasMoreBlocks(false);
					}
					setBlocks((prev) => {
						const newBlocks = result.blocks.filter((newBlock) => !prev.some((b) => b.id === newBlock.id));
						return [...prev, ...newBlocks];
					});
				} else {
					setHasMoreBlocks(false);
				}
			} catch (error) {
				console.error("Failed to fetch director blocks:", error);
			} finally {
				setBlocksLoading(false);
			}
		};
		fetchBlocks();
	}, [slug, blocksPage]);

	// Intersection observer for infinite scroll
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMoreBlocks && !blocksLoading) {
					setBlocksPage((prev) => prev + 1);
				}
			},
			{ threshold: 0.1 },
		);
		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}
		return () => {
			if (observerTarget.current) {
				observer.unobserve(observerTarget.current);
			}
		};
	}, [hasMoreBlocks, blocksLoading]);

	// Transform works data to match WorkCard interface (used for hero click and presentation mode)
	const transformWork = (work: Work, directorTitle: string, directorSlug: string) => ({
		title: work.title,
		slug: work.slug,
		client: work.client || "",
		agency: work.agency || "",
		shortDescription: work.shortDescription || "",
		starring: work.starrings?.map((s) => s.title).join(", ") || "",
		directors: [{ title: directorTitle, slug: directorSlug }],
		videoUrl: work.videoUrl720p || work.videoUrl || "",
		previewVideoUrl: work.previewVideoUrl || "",
		hlsUrl: work.hlsUrl || "",
		optimizedVideoUrl: work.optimizedVideoUrl || "",
		images: work.images || null,
	});

	const handleSelectWork = (work: any, rect: CardRect) => {
		setSelectedWork(work);
		setSelectedCardRect(rect);
	};

	const handleCloseModal = () => {
		setSelectedWork(null);
		setSelectedCardRect(null);
	};

	// Handle work click from block renderer
	const handleBlockWorkClick = (item: BlockContentItem, rect?: CardRect) => {
		if (!item.work) return;
		setSelectedWork({
			title: item.work.title,
			slug: item.work.slug,
			client: item.work.client,
			agency: item.work.agency,
			shortDescription: item.work.shortDescription,
			starring: item.work.starring,
			directors: item.work.directors,
			videoUrl: item.work.videoUrl || "",
			videoThumbnailUrl: item.work.thumbnail || "",
			images: null,
		});
		setSelectedCardRect(rect || null);
	};

	// Sort works for presentation mode grid
	const sortedWorks = director?.works ? [...director.works].sort((a, b) => a.sortOrder - b.sortOrder) : [];

	// Use explicitly selected hero work from API, no fallback to first work
	const heroWork = director?.heroWork ? { work: director.heroWork } : null;

	// Determine hero video source: heroVideo clip > heroVideo original > hero work video
	const heroVideoUrl = heroWork
		? director?.heroVideo?.clipUrl ||
			director?.heroVideo?.videoUrl720p ||
			director?.heroVideo?.videoUrl ||
			heroWork.work?.videoUrl720p ||
			heroWork.work?.videoUrl ||
			null
		: null;

	if (loading) {
		return (
			<main className="min-h-screen bg-black text-white flex items-center justify-center">
				<p>Loading...</p>
			</main>
		);
	}

	// Show error page based on error type
	if (!loading && (error || !director)) {
		return (
			<>
				<ScrollProgress />
				<MouseTrail />
				<Navbar theme="light" fixed />
				<DropdownMenu />

				<main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
					<div className="max-w-2xl mx-auto text-center">
						{/* 404 Text */}
						<div className="mb-8">
							<h1 className="text-9xl md:text-[150px] font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-400 to-gray-600 leading-none">
								404
							</h1>
						</div>

						{/* Subtext */}
						<div className="mb-12">
							<h2 className="text-3xl md:text-4xl font-bold mb-4">{error}</h2>
							<p className="text-gray-400 text-lg">
								{errorType === "director"
									? "The director you're looking for doesn't exist."
									: `The work you're looking for doesn't exist in ${director?.title || "this director"}'s portfolio.`}
							</p>
						</div>

						{/* Action Buttons */}
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<a
								href="/"
								className="px-8 py-3 border border-white text-white font-semibold rounded-2xl hover:bg-white/10 transition-colors duration-300"
							>
								Go Home
							</a>
							<a
								href="/directors"
								className="px-8 py-3 bg-white text-black font-semibold rounded-2xl hover:bg-gray-200 transition-colors duration-300"
							>
								View Directors
							</a>
						</div>

						{/* Decorative element */}
						<div className="w-fit mx-auto mt-16 pt-8 border-t border-gray-800">
							<p className="text-gray-500 text-sm">If you believe this is a mistake, please contact support.</p>
						</div>
					</div>
				</main>
			</>
		);
	}

	return (
		<>
			<ScrollProgress />
			<MouseTrail />
			<Navbar theme="light" fixed />
			<DropdownMenu />

			{/* Hero Section */}
			<div className={`relative h-screen ${blocks.length > 0 || sortedWorks.length > 1 ? "max-h-[75vh]" : ""} w-full`}>
				{/* Background Video/Image */}
				<div className="absolute inset-0">
					{heroVideoUrl ? (
						<video src={heroVideoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
					) : heroWork?.work?.images ? (
						<img
							src={heroWork.work.images.large || heroWork.work.images.original}
							alt={heroWork.work.title}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full bg-black" />
					)}
					<div className="absolute inset-0 bg-black/20" />
				</div>

				{/* Hero Content */}
				<div
					className={`absolute w-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4${heroWork ? " cursor-pointer" : ""}`}
					onClick={() => {
						if (!heroWork) return;
						const rect = document.querySelector(".hero-work-trigger")?.getBoundingClientRect();
						if (rect) {
							handleSelectWork(transformWork(heroWork.work, director.title, director.slug), {
								top: rect.top,
								left: rect.left,
								width: rect.width,
								height: rect.height,
							});
						}
					}}
				>
					<div className="hero-work-trigger text-center">
						<p className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6">{director.title}</p>
						{director.shortDescription && (
							<div className="flex items-center justify-center mb-6">
								<motion.p
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.15 }}
									className="max-w-lg text-gray-100"
								>
									{director.shortDescription}
								</motion.p>
							</div>
						)}
						{heroWork && (
							<div className="flex flex-col md:flex-row items-center justify-center gap-4">
								<div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-8 h-8 ml-1">
										<path d="M21,12c0,.3-.2.7-.5.8l-14,9c-.2.1-.3.2-.5.2s-.3,0-.5-.1c-.3-.2-.5-.5-.5-.9V3c0-.4.2-.7.5-.9.3-.2.7-.2,1,0l14,9c.3.2.5.5.5.8Z" />
									</svg>
								</div>
								<div className="">
									<p className="text-gray-300 text-lg md:text-2xl flex flex-col md:flex-row gap-2">
										<span className="hidden md:inline">Watch </span>
										<span className="text-white">{heroWork.work.title}</span>
									</p>
									{heroWork.work.shortDescription && (
										<p className="text-gray-300 text-sm md:text-base">
											{heroWork.work.shortDescription.length > 32
												? `${heroWork.work.shortDescription.slice(0, 32).trimEnd()}...`
												: heroWork.work.shortDescription}
										</p>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Biography / Links / Avatar Section */}
			{(director.biography || (director.links && director.links.length > 0) || director.avatar) && (
				<div className="bg-white text-black">
					<div className="px-6 md:px-12 py-16 md:py-12">
						<div className="flex flex-col lg:flex-row gap-12 md:gap-16">
							{director.biography && (
								<div className="flex-1 min-w-0">
									{/* Director Name */}
									<h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8 uppercase">
										{director.title}
									</h2>
									{/* Left: Biography */}
									<div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-12">
										<div className="flex flex-col gap-2 mb-4">
											<span className="text-xs font-bold tracking-widest uppercase">BIOGRAPHY</span>
											<p className="text-sm md:text-base leading-relaxed text-gray-700 whitespace-pre-line">
												{director.biography}
											</p>
										</div>
										{/* Right: Links */}
										{director.links && director.links.length > 0 && (
											<div className="md:w-56 shrink-0">
												<div className="flex items-center gap-2 mb-4">
													<span className="text-xs font-bold tracking-widest uppercase">EXPLORE</span>
												</div>
												<div className="space-y-2">
													{director.links.map((link, index) => (
														<a
															key={index}
															href={link.url}
															target="_blank"
															rel="noopener noreferrer"
															className="flex items-center gap-2 text-sm text-black hover:opacity-60 transition-opacity group"
														>
															<span className="text-base">→</span>
															<span className="group-hover:underline">{link.title}</span>
														</a>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Right: Avatar */}
							{director.avatar && (
								<div className="w-48 md:w-56 shrink-0">
									<div className="relative w-full overflow-hidden">
										<img
											src={director.avatar.medium || director.avatar.original}
											alt={director.title}
											className="w-full h-full object-cover grayscale"
										/>
										<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
											<span className="text-white text-xs font-medium tracking-wider uppercase">{director.title}</span>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Works — Block Layout */}
			{blocks.length > 0 && (
				<section className="w-full">
					<BlockRenderer blocks={blocks} onWorkClick={handleBlockWorkClick} />
				</section>
			)}

			{/* Intersection Observer Target for Infinite Scroll */}
			{hasMoreBlocks && (
				<div ref={observerTarget} className="w-full py-8 flex justify-center">
					{blocksLoading && <div className="text-white text-sm animate-pulse">Loading more blocks...</div>}
				</div>
			)}

			<AnimatePresence>
				{selectedWork && <WorkModal work={selectedWork} cardRect={selectedCardRect} onClose={handleCloseModal} />}
			</AnimatePresence>
		</>
	);
}

export default function Director() {
	return (
		<Suspense fallback={<div className="min-h-screen bg-black" />}>
			<DirectorContent />
		</Suspense>
	);
}
