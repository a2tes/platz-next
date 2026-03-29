"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";

interface Animation {
	title: string;
	slug: string;
	client: string;
	shortDescription: string;
	videoUrl: string;
	hlsUrl?: string;
	optimizedVideoUrl?: string;
	previewVideoUrl?: string;
	images: {
		thumbnail: string;
		small: string;
		medium: string;
		large: string;
		original: string;
	} | null;
}

export interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

interface AnimationCardProps {
	animation: Animation;
	onSelect: (animation: Animation, rect: CardRect) => void;
}

export default function AnimationCard({ animation, onSelect }: AnimationCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isHovering, setIsHovering] = useState(false);
	const [videoLoaded, setVideoLoaded] = useState(false);
	const [isVideoPlaying, setIsVideoPlaying] = useState(false);

	const handleClick = () => {
		if (cardRef.current) {
			const rect = cardRef.current.getBoundingClientRect();
			onSelect(animation, {
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
		const previewUrl = animation.previewVideoUrl || animation.optimizedVideoUrl || animation.videoUrl;

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

	const thumbnailUrl = animation.images?.large || animation.images?.original;

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
						alt={animation.title}
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
				{(animation.optimizedVideoUrl || animation.videoUrl) && (
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
				<h4 className="title">{animation.title}</h4>
				<h5 className="subtitle">{animation.shortDescription}</h5>
			</div>
		</motion.div>
	);
}
