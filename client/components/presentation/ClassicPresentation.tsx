"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import WorkModal from "@/components/works/WorkModal";
import AnimationModal from "@/components/animations/AnimationModal";
import PhotoModal, { type Photo } from "@/components/photography/PhotoModal";
import type { PresentationData, PresentationSection, PresentationItem } from "./types";

interface ClassicPresentationProps {
	data: PresentationData;
}

interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

export default function ClassicPresentation({ data }: ClassicPresentationProps) {
	// Work modal state
	const [selectedWork, setSelectedWork] = useState<any>(null);
	const [workCardRect, setWorkCardRect] = useState<CardRect | null>(null);

	// Animation modal state
	const [selectedAnimation, setSelectedAnimation] = useState<any>(null);
	const [animCardRect, setAnimCardRect] = useState<CardRect | null>(null);

	// Photo modal state
	const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
	const [photoCardRect, setPhotoCardRect] = useState<CardRect | null>(null);
	const [allPhotosInSection, setAllPhotosInSection] = useState<Photo[]>([]);

	const handleWorkClick = (item: PresentationItem, rect: CardRect) => {
		if (!item.work) return;
		const w = item.work;
		setSelectedWork({
			title: w.title,
			slug: w.slug,
			client: w.clients[0] || "",
			agency: w.agencies[0] || "",
			shortDescription: w.shortDescription,
			subtitle: w.subtitle,
			caseStudy: w.caseStudy,
			starring: w.starrings.map((s) => s.title).join(", "),
			directors: w.directors,
			videoUrl: w.videoUrl || "",
			hlsUrl: w.hlsUrl || "",
			optimizedVideoUrl: w.optimizedVideoUrl || "",
			videoThumbnailUrl: w.images?.thumbnail || "",
		});
		setWorkCardRect(rect);
	};

	const handleAnimationClick = (item: PresentationItem, rect: CardRect) => {
		if (!item.animation) return;
		const a = item.animation;
		setSelectedAnimation({
			title: a.title,
			slug: a.slug,
			client: a.clients[0] || "",
			agency: a.agencies[0] || "",
			shortDescription: a.shortDescription,
			videoUrl: a.videoUrl || "",
			hlsUrl: a.hlsUrl || "",
			optimizedVideoUrl: a.optimizedVideoUrl || "",
			videoThumbnailUrl: a.images?.thumbnail || "",
		});
		setAnimCardRect(rect);
	};

	const handlePhotoClick = (item: PresentationItem, rect: CardRect, sectionPhotos: Photo[]) => {
		if (!item.photography) return;
		const p = item.photography;
		const photo: Photo = {
			title: p.title,
			slug: p.slug,
			year: p.year || undefined,
			description: p.description || undefined,
			location: p.location || undefined,
			client: p.clients[0] || undefined,
			images: p.images as any,
			photographer: p.photographer ? { title: p.photographer.title, slug: "" } : { title: "", slug: "" },
			category: { title: p.categories[0] || "", slug: "" },
		};
		setSelectedPhoto(photo);
		setPhotoCardRect(rect);
		setAllPhotosInSection(sectionPhotos);
	};

	return (
		<div className="min-h-screen bg-black pt-20 pb-20">
			{/* Sections */}
			{data.sections.map((section, sIdx) => (
				<SectionBlock
					key={sIdx}
					section={section}
					onWorkClick={handleWorkClick}
					onAnimationClick={handleAnimationClick}
					onPhotoClick={handlePhotoClick}
				/>
			))}

			{/* End */}
			<div className="flex flex-col items-center justify-center py-20">
				<span className="text-white/40 text-sm tracking-[4px]">END OF PRESENTATION</span>
			</div>

			{/* Modals */}
			<AnimatePresence>
				{selectedWork && (
					<WorkModal
						work={selectedWork}
						cardRect={workCardRect}
						onClose={() => {
							setSelectedWork(null);
							setWorkCardRect(null);
						}}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{selectedAnimation && (
					<AnimationModal
						animation={selectedAnimation}
						cardRect={animCardRect}
						onClose={() => {
							setSelectedAnimation(null);
							setAnimCardRect(null);
						}}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{selectedPhoto && (
					<PhotoModal
						photo={selectedPhoto}
						cardRect={photoCardRect}
						onClose={() => {
							setSelectedPhoto(null);
							setPhotoCardRect(null);
						}}
						allPhotos={allPhotosInSection}
						onNavigate={(p) => setSelectedPhoto(p)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

// --- Section Block ---

interface SectionBlockProps {
	section: PresentationSection;
	onWorkClick: (item: PresentationItem, rect: CardRect) => void;
	onAnimationClick: (item: PresentationItem, rect: CardRect) => void;
	onPhotoClick: (item: PresentationItem, rect: CardRect, photos: Photo[]) => void;
}

function SectionBlock({ section, onWorkClick, onAnimationClick, onPhotoClick }: SectionBlockProps) {
	// Separate items by type for rendering
	const hasPhotos = section.items.some((i) => i.itemType === "PHOTOGRAPHY");
	const hasVideos = section.items.some((i) => i.itemType === "WORK" || i.itemType === "ANIMATION");
	const hasExternalLinks = section.items.some((i) => i.itemType === "EXTERNAL_LINK");

	// Convert photography items to Photo[] for modal navigation
	const sectionPhotos: Photo[] = section.items
		.filter((i) => i.itemType === "PHOTOGRAPHY" && i.photography)
		.map((i) => {
			const p = i.photography!;
			return {
				title: p.title,
				slug: p.slug,
				year: p.year || undefined,
				description: p.description || undefined,
				location: p.location || undefined,
				client: p.clients[0] || undefined,
				images: p.images as any,
				photographer: p.photographer ? { title: p.photographer.title, slug: "" } : { title: "", slug: "" },
				category: { title: p.categories[0] || "", slug: "" },
			};
		});

	return (
		<section className="mb-16 px-6 md:px-12">
			{/* Section title */}
			<motion.h2
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, margin: "-50px" }}
				transition={{ duration: 0.6 }}
				className="text-white text-xl md:text-2xl font-light mb-8 tracking-wide"
			>
				{section.title}
			</motion.h2>

			{/* Video items - horizontal scroll */}
			{hasVideos && (
				<div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-6 px-6 md:-mx-12 md:px-12">
					{section.items
						.filter((i) => i.itemType === "WORK" || i.itemType === "ANIMATION")
						.map((item, idx) => (
							<VideoCard key={idx} item={item} onWorkClick={onWorkClick} onAnimationClick={onAnimationClick} />
						))}
				</div>
			)}

			{/* Photography items - grid */}
			{hasPhotos && (
				<div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 ${hasVideos ? "mt-8" : ""}`}>
					{section.items
						.filter((i) => i.itemType === "PHOTOGRAPHY")
						.map((item, idx) => (
							<PhotoCard key={idx} item={item} onClick={(rect) => onPhotoClick(item, rect, sectionPhotos)} />
						))}
				</div>
			)}

			{/* External Link items */}
			{hasExternalLinks && (
				<div
					className={`flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-6 px-6 md:-mx-12 md:px-12 ${hasVideos || hasPhotos ? "mt-8" : ""}`}
				>
					{section.items
						.filter((i) => i.itemType === "EXTERNAL_LINK")
						.map((item, idx) => (
							<ExternalLinkCard key={idx} item={item} />
						))}
				</div>
			)}
		</section>
	);
}

// --- Video Card ---

interface VideoCardProps {
	item: PresentationItem;
	onWorkClick: (item: PresentationItem, rect: CardRect) => void;
	onAnimationClick: (item: PresentationItem, rect: CardRect) => void;
}

function VideoCard({ item, onWorkClick, onAnimationClick }: VideoCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isHovering, setIsHovering] = useState(false);
	const [videoLoaded, setVideoLoaded] = useState(false);

	const entity = item.work || item.animation;
	if (!entity) return null;

	const thumbnail = entity.images?.medium || entity.images?.large || entity.images?.thumbnail || "";
	const previewUrl = entity.optimizedVideoUrl || entity.videoUrl;
	const title = entity.title;
	const subtitle = (() => {
		if (item.work) {
			return item.work.clients[0] || item.work.directors[0]?.title || "";
		}
		if (item.animation) {
			return item.animation.clients[0] || "";
		}
		return "";
	})();

	const handleClick = () => {
		if (!cardRef.current) return;
		const rect = cardRef.current.getBoundingClientRect();
		const cardRect: CardRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
		if (item.itemType === "WORK") onWorkClick(item, cardRect);
		else onAnimationClick(item, cardRect);
	};

	const handleMouseEnter = () => {
		setIsHovering(true);
		if (previewUrl && videoRef.current && !videoLoaded) {
			videoRef.current.src = previewUrl;
			videoRef.current.load();
			setVideoLoaded(true);
		}
		if (videoRef.current && previewUrl) {
			videoRef.current.currentTime = 0;
			videoRef.current.play().catch(() => {});
		}
	};

	const handleMouseLeave = () => {
		setIsHovering(false);
		if (videoRef.current) {
			videoRef.current.pause();
			videoRef.current.currentTime = 0;
		}
	};

	return (
		<motion.div
			ref={cardRef}
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-30px" }}
			transition={{ duration: 0.5 }}
			className="flex-shrink-0 w-[300px] md:w-[400px] snap-start cursor-pointer group"
			onClick={handleClick}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<div className="relative aspect-video rounded-lg overflow-hidden bg-white/5">
				{/* Thumbnail */}
				{thumbnail && (
					<img
						src={thumbnail}
						alt={title}
						className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
						style={{ opacity: isHovering && videoLoaded ? 0 : 1 }}
						loading="lazy"
					/>
				)}
				{/* Preview video */}
				{previewUrl && (
					<video
						ref={videoRef}
						className="absolute inset-0 w-full h-full object-cover"
						muted
						playsInline
						loop
						style={{ opacity: isHovering && videoLoaded ? 1 : 0 }}
					/>
				)}
				{/* Play icon */}
				<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="white">
							<polygon points="5,3 19,12 5,21" />
						</svg>
					</div>
				</div>
			</div>
			{/* Info */}
			<div className="mt-3">
				<p className="text-white text-sm font-light truncate">{title}</p>
				{subtitle && <p className="text-white/40 text-xs font-light truncate mt-0.5">{subtitle}</p>}
			</div>
		</motion.div>
	);
}

// --- Photo Card ---

interface PhotoCardProps {
	item: PresentationItem;
	onClick: (rect: CardRect) => void;
}

function PhotoCard({ item, onClick }: PhotoCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const photo = item.photography;
	if (!photo) return null;

	const imageUrl = photo.images?.medium || photo.images?.large || photo.images?.thumbnail || "";

	const handleClick = () => {
		if (!cardRef.current) return;
		const rect = cardRef.current.getBoundingClientRect();
		onClick({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
	};

	return (
		<motion.div
			ref={cardRef}
			initial={{ opacity: 0, scale: 0.95 }}
			whileInView={{ opacity: 1, scale: 1 }}
			viewport={{ once: true, margin: "-30px" }}
			transition={{ duration: 0.5 }}
			className="relative aspect-[3/4] rounded-lg overflow-hidden bg-white/5 cursor-pointer group"
			onClick={handleClick}
		>
			{imageUrl && (
				<img
					src={imageUrl}
					alt={photo.title}
					className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
					loading="lazy"
				/>
			)}
			{/* Hover overlay */}
			<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
				<div className="absolute bottom-3 left-3 right-3">
					<p className="text-white text-sm font-light truncate">{photo.title}</p>
					{photo.photographer && <p className="text-white/50 text-xs truncate mt-0.5">{photo.photographer.title}</p>}
				</div>
			</div>
		</motion.div>
	);
}

// --- External Link Card ---

function ExternalLinkCard({ item }: { item: PresentationItem }) {
	const thumbnail =
		item.externalThumbnail?.images?.medium ||
		item.externalThumbnail?.images?.large ||
		item.externalThumbnail?.images?.thumbnail ||
		"";
	const title = item.externalTitle || "External Link";
	const url = item.externalUrl || "#";

	return (
		<motion.a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-30px" }}
			transition={{ duration: 0.5 }}
			className="flex-shrink-0 w-[300px] md:w-[400px] snap-start cursor-pointer group"
		>
			<div className="relative aspect-video rounded-lg overflow-hidden bg-white/5">
				{thumbnail ? (
					<img
						src={thumbnail}
						alt={title}
						className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
						loading="lazy"
					/>
				) : (
					<div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
						<svg
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="opacity-30"
						>
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
							<polyline points="15 3 21 3 21 9" />
							<line x1="10" y1="14" x2="21" y2="3" />
						</svg>
					</div>
				)}
				{/* Hover overlay */}
				<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
							<polyline points="15 3 21 3 21 9" />
							<line x1="10" y1="14" x2="21" y2="3" />
						</svg>
					</div>
				</div>
			</div>
			{/* Info */}
			<div className="mt-3">
				<p className="text-white text-sm font-light truncate">{title}</p>
				<p className="text-white/40 text-xs font-light truncate mt-0.5">External Link</p>
			</div>
		</motion.a>
	);
}
