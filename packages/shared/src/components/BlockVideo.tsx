"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { calculateClipPath } from "../utils";
import type { BlockContentItem } from "../types";

export interface BlockVideoProps {
	/** Video source URL (HLS or MP4) */
	src: string;
	/** Poster image URL */
	poster?: string;
	/** Crop settings */
	crop?: Pick<BlockContentItem, "cropX" | "cropY" | "cropW" | "cropH">;
	/** Trim settings */
	trim?: Pick<BlockContentItem, "trimStart" | "trimEnd">;
	/** Enable autoplay with Intersection Observer */
	autoplay?: boolean;
	/** Loop video */
	loop?: boolean;
	/** Mute video */
	muted?: boolean;
	/** Additional class names */
	className?: string;
	/** Intersection Observer threshold (0-1) */
	intersectionThreshold?: number;
	/** Callback when video is visible */
	onVisible?: () => void;
	/** Callback when video is hidden */
	onHidden?: () => void;
}

export function BlockVideo({
	src,
	poster,
	crop,
	trim,
	autoplay = true,
	loop = true,
	muted = true,
	className = "",
	intersectionThreshold = 0.5,
	onVisible,
	onHidden,
}: BlockVideoProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);

	// Calculate clip-path from crop settings
	const clipPath = crop ? calculateClipPath(crop.cropX, crop.cropY, crop.cropW, crop.cropH) : undefined;

	// Handle time update for trim end
	const handleTimeUpdate = useCallback(() => {
		const video = videoRef.current;
		if (!video || !trim?.trimEnd) return;

		if (video.currentTime >= trim.trimEnd) {
			if (loop && trim.trimStart !== undefined) {
				video.currentTime = trim.trimStart;
			} else {
				video.pause();
				setIsPlaying(false);
			}
		}
	}, [trim, loop]);

	// Handle video play
	const playVideo = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;

		// Set start time if trim is configured
		if (trim?.trimStart !== undefined && video.currentTime < trim.trimStart) {
			video.currentTime = trim.trimStart;
		}

		video
			.play()
			.then(() => {
				setIsPlaying(true);
			})
			.catch((error) => {
				// Autoplay might be blocked
				console.warn("Video autoplay blocked:", error);
			});
	}, [trim]);

	// Handle video pause
	const pauseVideo = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;

		video.pause();
		setIsPlaying(false);
	}, []);

	// Intersection Observer for autoplay
	useEffect(() => {
		if (!autoplay || !containerRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const visible = entry.isIntersecting;
					setIsVisible(visible);

					if (visible) {
						playVideo();
						onVisible?.();
					} else {
						pauseVideo();
						onHidden?.();
					}
				});
			},
			{ threshold: intersectionThreshold },
		);

		observer.observe(containerRef.current);

		return () => {
			observer.disconnect();
		};
	}, [autoplay, intersectionThreshold, playVideo, pauseVideo, onVisible, onHidden]);

	// Add time update listener
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		video.addEventListener("timeupdate", handleTimeUpdate);

		return () => {
			video.removeEventListener("timeupdate", handleTimeUpdate);
		};
	}, [handleTimeUpdate]);

	return (
		<div ref={containerRef} className={`relative overflow-hidden ${className}`}>
			<video
				ref={videoRef}
				src={src}
				poster={poster}
				muted={muted}
				loop={!trim?.trimEnd && loop}
				playsInline
				preload="metadata"
				className="w-full h-full object-cover"
				style={{
					clipPath,
				}}
			/>
		</div>
	);
}
