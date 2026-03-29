"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
	/** HLS manifest URL (m3u8) */
	hlsUrl?: string;
	/** Optimized MP4 URL (fallback for Safari) */
	mp4Url?: string;
	/** Original video URL (last resort fallback) */
	fallbackUrl?: string;
	/** Poster image URL */
	poster?: string;
	/** CSS class name */
	className?: string;
	/** Auto play video */
	autoPlay?: boolean;
	/** Muted video */
	muted?: boolean;
	/** Loop video */
	loop?: boolean;
	/** Show controls */
	controls?: boolean;
	/** Playback quality preference: 'auto' | '1080p' | '720p' | '480p' */
	quality?: "auto" | "1080p" | "720p" | "480p";
	/** Callback when video is ready to play */
	onReady?: () => void;
	/** Callback when video starts playing */
	onPlay?: () => void;
	/** Callback when video pauses */
	onPause?: () => void;
	/** Callback when video ends */
	onEnded?: () => void;
	/** Callback on error */
	onError?: (error: Error) => void;
}

/**
 * Adaptive video player with HLS.js support
 * Falls back to native HLS (Safari) or MP4 if HLS.js not supported
 */
export function VideoPlayer({
	hlsUrl,
	mp4Url,
	fallbackUrl,
	poster,
	className = "",
	autoPlay = false,
	muted = false,
	loop = false,
	controls = true,
	quality = "auto",
	onReady,
	onPlay,
	onPause,
	onEnded,
	onError,
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentQuality, setCurrentQuality] = useState<string>("auto");

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		// Clean up previous HLS instance
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}

		// Determine best source to use
		const loadVideo = async () => {
			setIsLoading(true);
			setError(null);

			// Priority: HLS > MP4 > Fallback
			if (hlsUrl && Hls.isSupported()) {
				// Use HLS.js for browsers that support MediaSource Extensions
				const hls = new Hls({
					enableWorker: true,
					lowLatencyMode: false,
					startLevel: quality === "auto" ? -1 : getQualityLevel(quality),
					// Optimize for fast start
					maxBufferLength: 30,
					maxMaxBufferLength: 60,
					// Network settings
					fragLoadingTimeOut: 20000,
					manifestLoadingTimeOut: 10000,
					levelLoadingTimeOut: 10000,
				});

				hlsRef.current = hls;

				hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
					setIsLoading(false);
					setCurrentQuality(quality === "auto" ? `${data.levels.length} levels` : quality);
					onReady?.();

					if (autoPlay) {
						video.play().catch(() => {
							// Autoplay might be blocked, that's ok
						});
					}
				});

				hls.on(Hls.Events.ERROR, (_event, data) => {
					if (data.fatal) {
						console.error("HLS fatal error:", data.type, data.details);

						// Try fallback on fatal error
						if (mp4Url || fallbackUrl) {
							hls.destroy();
							hlsRef.current = null;
							loadFallback();
						} else {
							setError(`Video loading failed: ${data.details}`);
							onError?.(new Error(data.details));
						}
					}
				});

				hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
					const level = hls.levels[data.level];
					if (level) {
						setCurrentQuality(`${level.height}p`);
					}
				});

				hls.loadSource(hlsUrl);
				hls.attachMedia(video);
			} else if (hlsUrl && video.canPlayType("application/vnd.apple.mpegurl")) {
				// Native HLS support (Safari)
				video.src = hlsUrl;
				video.addEventListener("loadedmetadata", () => {
					setIsLoading(false);
					onReady?.();
				});
				video.addEventListener("error", () => loadFallback());
			} else {
				// No HLS support, use MP4 fallback
				loadFallback();
			}
		};

		const loadFallback = () => {
			const video = videoRef.current;
			if (!video) return;

			const source = mp4Url || fallbackUrl;
			if (!source) {
				setError("No video source available");
				setIsLoading(false);
				return;
			}

			video.src = source;
			video.addEventListener(
				"loadedmetadata",
				() => {
					setIsLoading(false);
					setCurrentQuality("MP4");
					onReady?.();
				},
				{ once: true }
			);
			video.addEventListener(
				"error",
				() => {
					setError("Failed to load video");
					setIsLoading(false);
					onError?.(new Error("Failed to load video"));
				},
				{ once: true }
			);
		};

		loadVideo();

		// Cleanup
		return () => {
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
		};
	}, [hlsUrl, mp4Url, fallbackUrl, quality, autoPlay, onReady, onError]);

	// Quality level mapping for HLS.js
	const getQualityLevel = (q: string): number => {
		switch (q) {
			case "1080p":
				return 0;
			case "720p":
				return 1;
			case "480p":
				return 2;
			default:
				return -1; // auto
		}
	};

	// Manual quality switching
	const switchQuality = (newQuality: "auto" | "1080p" | "720p" | "480p") => {
		if (hlsRef.current) {
			hlsRef.current.currentLevel = getQualityLevel(newQuality);
			if (newQuality === "auto") {
				hlsRef.current.currentLevel = -1; // Enable ABR
			}
		}
	};

	return (
		<div className={`relative ${className}`}>
			<video
				ref={videoRef}
				poster={poster}
				autoPlay={autoPlay}
				muted={muted}
				loop={loop}
				controls={controls}
				playsInline
				className="w-full h-full object-cover"
				onPlay={() => onPlay?.()}
				onPause={() => onPause?.()}
				onEnded={() => onEnded?.()}
			>
				{/* Fallback for very old browsers */}
				<p>Your browser does not support the video tag.</p>
			</video>

			{/* Loading overlay */}
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/50">
					<div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
				</div>
			)}

			{/* Error overlay */}
			{error && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/80">
					<div className="text-white text-center p-4">
						<p className="text-red-400 mb-2">⚠️ Error</p>
						<p className="text-sm">{error}</p>
					</div>
				</div>
			)}

			{/* Quality indicator (optional) */}
			{!isLoading && !error && hlsUrl && (
				<div className="absolute bottom-14 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
					{currentQuality}
				</div>
			)}
		</div>
	);
}

export default VideoPlayer;
