"use client";

import { useRef, useState, useEffect } from "react";
import { BlockContentItem } from "@/lib/blocks";

interface BlockVideoProps {
	item: BlockContentItem;
	className?: string;
}

export function BlockVideo({ item, className = "" }: BlockVideoProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);

	// Get entity data
	const entity = item.work;

	// Get video URL — use clip if available, otherwise entity video
	const videoUrl = item.clip?.url || entity?.videoUrl || "";
	const posterUrl = entity?.thumbnailUrl || entity?.thumbnail || "";

	// Intersection Observer for autoplay when visible
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				setIsVisible(entry.isIntersecting);
			},
			{
				threshold: 0.5,
				rootMargin: "50px",
			},
		);

		observer.observe(video);

		return () => {
			observer.disconnect();
		};
	}, []);

	// Handle play/pause based on visibility
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !isLoaded) return;

		if (isVisible) {
			video.play().catch(() => {
				// Autoplay was prevented
			});
		} else {
			video.pause();
		}
	}, [isVisible, isLoaded]);

	if (!videoUrl) return null;

	return (
		<video
			ref={videoRef}
			src={videoUrl}
			poster={posterUrl}
			className={`w-full h-full object-cover pointer-events-none ${className}`}
			muted
			playsInline
			loop
			onLoadedData={() => setIsLoaded(true)}
		/>
	);
}
