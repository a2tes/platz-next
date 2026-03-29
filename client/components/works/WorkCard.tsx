"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";

interface Work {
	title: string;
	slug: string;
	client: string;
	agency?: string;
	shortDescription: string;
	subtitle?: string;
	caseStudy?: string;
	starring: string;
	directors?: Array<{ title: string; slug?: string }>;
	videoUrl: string;
	hlsUrl?: string;
	optimizedVideoUrl?: string;
	previewVideoUrl?: string;
	images: {
		thumbnail?: string;
		small?: string;
		medium?: string;
		large?: string;
		original?: string;
	} | null;
}

export interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

interface WorkCardProps {
	work: Work;
	onSelect: (work: Work, rect: CardRect) => void;
}

export default function WorkCard({ work, onSelect }: WorkCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isHovering, setIsHovering] = useState(false);
	const [videoLoaded, setVideoLoaded] = useState(false);
	const [isVideoPlaying, setIsVideoPlaying] = useState(false);

	const handleClick = () => {
		if (cardRef.current) {
			const rect = cardRef.current.getBoundingClientRect();
			onSelect(work, {
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
			});
		}
	};

	const handleMouseEnter = () => {
		setIsHovering(true);

		// Use 480p preview video for fast hover, fallback to optimized or original
		const previewUrl = work.previewVideoUrl || work.optimizedVideoUrl || work.videoUrl;

		// Lazy load video on first hover
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
		setIsVideoPlaying(false);
		if (videoRef.current) {
			videoRef.current.pause();
			videoRef.current.currentTime = 0;
		}
	};

	const handleVideoPlaying = () => {
		setIsVideoPlaying(true);
	};

	const thumbnailUrl = work.images?.large || work.images?.original;

	return (
		<motion.div
			ref={cardRef}
			className="work-item"
			onClick={handleClick}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			style={{ cursor: "pointer" }}
		>
			<div className="work-media">
				{/* Thumbnail image - always rendered */}
				{thumbnailUrl ? (
					<img
						src={thumbnailUrl}
						alt={work.title}
						style={{
							width: "100%",
							height: "100%",
							objectFit: "cover",
							opacity: isVideoPlaying ? 0 : 1,
							transition: "opacity 0.3s ease",
						}}
					/>
				) : (
					<div
						style={{
							width: "100%",
							height: "100%",
							backgroundColor: "#1f2937",
							opacity: isVideoPlaying ? 0 : 1,
							transition: "opacity 0.3s ease",
						}}
					/>
				)}

				{/* Video - lazy loaded and plays on hover */}
				{(work.optimizedVideoUrl || work.videoUrl) && (
					<video
						ref={videoRef}
						muted
						loop
						playsInline
						preload="none"
						onPlaying={handleVideoPlaying}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: "100%",
							objectFit: "cover",
							opacity: isVideoPlaying ? 1 : 0,
							transition: "opacity 0.3s ease",
						}}
					/>
				)}
			</div>
			<div className="work-info">
				<h4 className="title">{work.title}</h4>
				<h5 className="subtitle">{work.shortDescription}</h5>
			</div>
		</motion.div>
	);
}
