"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";
import Navbar from "@/components/Navbar";
import WorkCard, { CardRect } from "@/components/works/WorkCard";
import WorkModal from "@/components/works/WorkModal";
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
	videoUrl?: string;
	videoUrl720p?: string;
	hlsUrl?: string;
	optimizedVideoUrl?: string;
	previewVideoUrl?: string;
	videoThumbnailUrl?: string;
	images?: {
		thumbnail: string;
		small: string;
		medium: string;
		large: string;
		original: string;
	} | null;
}

interface DirectorWork {
	sortOrder: number;
	work: Work;
}

interface Director {
	id: number;
	title: string;
	slug: string;
	shortDescription?: string;
	biography?: string;
	works?: DirectorWork[];
	createdAt: string;
	publishedAt: string;
}

function DirectorWorkContent() {
	const params = useParams();
	const slug = params?.slug as string;
	const workSlug = params?.workSlug as string;
	const [director, setDirector] = useState<Director | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [errorType, setErrorType] = useState<"director" | "work" | null>(null);
	const [selectedWork, setSelectedWork] = useState<any | null>(null);
	const [selectedCardRect, setSelectedCardRect] = useState<CardRect | null>(null);

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

				const directorData: Director = await res.json();

				// Check if workSlug exists in director's works
				const workExists = directorData?.works?.some((w) => w.work.slug === workSlug);
				if (!workExists) {
					setError("Work not found");
					setErrorType("work");
					setDirector(directorData);
					setLoading(false);
					return;
				}

				setDirector(directorData);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load director");
				console.error("Director fetch error:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchDirector();
	}, [slug, workSlug]);

	// Transform works data to match WorkCard interface
	const transformWork = (work: Work, directorTitle: string, directorSlug: string) => ({
		title: work.title,
		slug: work.slug,
		client: work.client || "",
		shortDescription: work.shortDescription || "",
		directors: [{ title: directorTitle, slug: directorSlug }],
		// Use 720p for background videos
		videoUrl: work.videoUrl720p || work.videoUrl || "",
		// HLS for modal playback
		hlsUrl: work.hlsUrl || "",
		optimizedVideoUrl: work.optimizedVideoUrl || "",
		// 480p for hover previews
		previewVideoUrl: work.previewVideoUrl || "",
		videoThumbnailUrl: work.videoThumbnailUrl || "",
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

	// Find the hero work (the one matching workSlug) and other works
	const allWorks = director?.works ? [...director.works].sort((a, b) => a.sortOrder - b.sortOrder) : [];

	const heroWorkItem = allWorks.find((w) => w.work.slug === workSlug);
	const gridWorks = allWorks.filter((w) => w.work.slug !== workSlug);

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
							{errorType === "director" ? (
								<a
									href="/directors"
									className="px-8 py-3 bg-white text-black font-semibold rounded-2xl hover:bg-gray-200 transition-colors duration-300"
								>
									View Directors
								</a>
							) : (
								<a
									href={`/directors/${slug}`}
									className="px-8 py-3 bg-white text-black font-semibold rounded-2xl hover:bg-gray-200 transition-colors duration-300"
								>
									View {director?.title}
								</a>
							)}
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

			{/* Hero Work */}
			{heroWorkItem && (
				<div className="relative h-screen w-full">
					{/* Background Image/Video */}
					<div className="absolute inset-0">
						{heroWorkItem.work.videoThumbnailUrl ? (
							<img
								src={heroWorkItem.work.videoThumbnailUrl}
								alt={heroWorkItem.work.title}
								className="w-full h-full object-cover"
							/>
						) : heroWorkItem.work.videoUrl ? (
							<video
								src={heroWorkItem.work.videoUrl}
								autoPlay
								muted
								loop
								playsInline
								className="w-full h-full object-cover"
							/>
						) : (
							<div className="w-full h-full bg-gray-900" />
						)}
						<div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
					</div>

					{/* Hero Content */}
					<div
						className="absolute bottom-0 left-0 right-0 p-8 md:p-16 cursor-pointer"
						onClick={() => {
							const rect = document.querySelector(".hero-work-trigger")?.getBoundingClientRect();
							if (rect) {
								handleSelectWork(transformWork(heroWorkItem.work, director.title, director.slug), {
									top: rect.top,
									left: rect.left,
									width: rect.width,
									height: rect.height,
								});
							}
						}}
					>
						<div className="hero-work-trigger">
							<p className="text-gray-400 text-sm uppercase tracking-widest mb-2">{director.title}</p>
							<h1 className="text-white text-4xl md:text-6xl font-bold mb-4">{heroWorkItem.work.title}</h1>
							{heroWorkItem.work.shortDescription && (
								<p className="text-gray-300 text-lg max-w-2xl mb-6">{heroWorkItem.work.shortDescription}</p>
							)}
							<div className="flex items-center gap-4">
								<div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-8 h-8 ml-1">
										<path d="M21,12c0,.3-.2.7-.5.8l-14,9c-.2.1-.3.2-.5.2s-.3,0-.5-.1c-.3-.2-.5-.5-.5-.9V3c0-.4.2-.7.5-.9.3-.2.7-.2,1,0l14,9c.3.2.5.5.5.8Z" />
									</svg>
								</div>
								<span className="text-white/80">Watch</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Works Grid */}
			{gridWorks.length > 0 && (
				<div className="grid-works">
					{gridWorks.map((dw) => (
						<WorkCard
							key={dw.work.slug}
							work={transformWork(dw.work, director.title, director.slug)}
							onSelect={handleSelectWork}
						/>
					))}
				</div>
			)}

			<AnimatePresence>
				{selectedWork && <WorkModal work={selectedWork} cardRect={selectedCardRect} onClose={handleCloseModal} />}
			</AnimatePresence>
		</>
	);
}

export default function DirectorWorkPage() {
	return (
		<Suspense fallback={<div className="min-h-screen bg-black" />}>
			<DirectorWorkContent />
		</Suspense>
	);
}
