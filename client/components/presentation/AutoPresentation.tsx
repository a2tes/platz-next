"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";
import type { PlayableItem, PresentationData } from "./types";

interface AutoPresentationProps {
	data: PresentationData;
	playlist: PlayableItem[];
	currentIndex: number;
	onIndexChange: (index: number) => void;
	onComplete: () => void;
}

export default function AutoPresentation({
	data,
	playlist,
	currentIndex,
	onIndexChange,
	onComplete,
}: AutoPresentationProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const photoTimerRef = useRef<NodeJS.Timeout | null>(null);
	const upNextTimerRef = useRef<NodeJS.Timeout | null>(null);
	const showUpNextRef = useRef(false);
	const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const photoElapsedRef = useRef(0);
	const photoDurationRef = useRef(0);

	const [isPlaying, setIsPlaying] = useState(true);
	const [isMuted, setIsMuted] = useState(false);
	const [showUpNext, setShowUpNext] = useState(false);
	const [progress, setProgress] = useState(0);
	const [showControls, setShowControls] = useState(true);
	const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

	const current = playlist[currentIndex];
	const next = playlist[currentIndex + 1];
	const isLastItem = currentIndex >= playlist.length - 1;

	const cleanupVideo = useCallback(() => {
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}
		if (photoTimerRef.current) {
			clearTimeout(photoTimerRef.current);
			photoTimerRef.current = null;
		}
		if (upNextTimerRef.current) {
			clearTimeout(upNextTimerRef.current);
			upNextTimerRef.current = null;
		}
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
			progressIntervalRef.current = null;
		}
		showUpNextRef.current = false;
		setShowUpNext(false);
		setProgress(0);
	}, []);

	const advanceToNext = useCallback(() => {
		if (currentIndex < playlist.length - 1) {
			onIndexChange(currentIndex + 1);
		} else {
			onComplete();
		}
	}, [currentIndex, playlist.length, onIndexChange, onComplete]);

	// Load current item
	useEffect(() => {
		if (!current) return;
		cleanupVideo();

		const item = current.item;

		if (item.itemType === "PHOTOGRAPHY" || item.itemType === "EXTERNAL_LINK") {
			const duration = (data.photoSlideDuration || 5) * 1000;
			photoElapsedRef.current = 0;
			photoDurationRef.current = duration;
			const interval = 100;

			progressIntervalRef.current = setInterval(() => {
				photoElapsedRef.current += interval;
				setProgress((photoElapsedRef.current / duration) * 100);
			}, interval);

			// Show "Up Next" 2 seconds before end (only if there's a next item)
			if (next && duration > 2000) {
				upNextTimerRef.current = setTimeout(() => {
					showUpNextRef.current = true;
					setShowUpNext(true);
				}, duration - 2000);
			}

			photoTimerRef.current = setTimeout(() => {
				if (progressIntervalRef.current) {
					clearInterval(progressIntervalRef.current);
					progressIntervalRef.current = null;
				}
				advanceToNext();
			}, duration);

			return () => {
				cleanupVideo();
			};
		}

		// Video item (WORK or ANIMATION)
		const video = videoRef.current;
		if (!video) return;

		const entity = item.work || item.animation;
		if (!entity) return;

		const hlsUrl = entity.hlsUrl;
		const mp4Url = entity.optimizedVideoUrl || entity.videoUrl;

		const setupVideoEvents = () => {
			const handleTimeUpdate = () => {
				if (video.duration) {
					const pct = (video.currentTime / video.duration) * 100;
					setProgress(pct);

					// Show "Up Next" ~5s before end
					if (next && video.duration - video.currentTime <= 5 && !showUpNextRef.current) {
						showUpNextRef.current = true;
						setShowUpNext(true);
					}
				}
			};

			const handleEnded = () => {
				advanceToNext();
			};

			video.addEventListener("timeupdate", handleTimeUpdate);
			video.addEventListener("ended", handleEnded);

			return () => {
				video.removeEventListener("timeupdate", handleTimeUpdate);
				video.removeEventListener("ended", handleEnded);
			};
		};

		let cleanupEvents: (() => void) | undefined;

		if (hlsUrl && Hls.isSupported()) {
			const hls = new Hls({
				enableWorker: true,
				lowLatencyMode: false,
				maxBufferLength: 30,
				maxMaxBufferLength: 60,
			});
			hlsRef.current = hls;

			hls.loadSource(hlsUrl);
			hls.attachMedia(video);

			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				video.play().catch(() => {});
				setIsPlaying(true);
			});

			hls.on(Hls.Events.ERROR, (_event, hlsData) => {
				if (hlsData.fatal && mp4Url) {
					hls.destroy();
					hlsRef.current = null;
					video.src = mp4Url;
					video.play().catch(() => {});
					setIsPlaying(true);
				}
			});

			cleanupEvents = setupVideoEvents();
		} else if (hlsUrl && video.canPlayType("application/vnd.apple.mpegurl")) {
			video.src = hlsUrl;
			video.play().catch(() => {});
			setIsPlaying(true);
			cleanupEvents = setupVideoEvents();
		} else if (mp4Url) {
			video.src = mp4Url;
			video.play().catch(() => {});
			setIsPlaying(true);
			cleanupEvents = setupVideoEvents();
		}

		return () => {
			cleanupEvents?.();
			cleanupVideo();
		};
	}, [currentIndex, current, next]);

	// Auto-hide controls
	const resetControlsTimer = useCallback(() => {
		setShowControls(true);
		if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
		controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
	}, []);

	useEffect(() => {
		resetControlsTimer();
		return () => {
			if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
		};
	}, [currentIndex]);

	const togglePlayPause = () => {
		const item = current?.item;
		if (!item) return;

		if (item.itemType === "PHOTOGRAPHY" || item.itemType === "EXTERNAL_LINK") {
			if (isPlaying) {
				// Pause: clear timers
				if (progressIntervalRef.current) {
					clearInterval(progressIntervalRef.current);
					progressIntervalRef.current = null;
				}
				if (photoTimerRef.current) {
					clearTimeout(photoTimerRef.current);
					photoTimerRef.current = null;
				}
				if (upNextTimerRef.current) {
					clearTimeout(upNextTimerRef.current);
					upNextTimerRef.current = null;
				}
				setIsPlaying(false);
			} else {
				// Resume: restart with remaining time
				const remaining = photoDurationRef.current - photoElapsedRef.current;
				if (remaining <= 0) {
					advanceToNext();
					return;
				}

				const interval = 100;
				progressIntervalRef.current = setInterval(() => {
					photoElapsedRef.current += interval;
					setProgress((photoElapsedRef.current / photoDurationRef.current) * 100);
				}, interval);

				if (next && remaining > 2000 && !showUpNextRef.current) {
					upNextTimerRef.current = setTimeout(() => {
						showUpNextRef.current = true;
						setShowUpNext(true);
					}, remaining - 2000);
				}

				photoTimerRef.current = setTimeout(() => {
					if (progressIntervalRef.current) {
						clearInterval(progressIntervalRef.current);
						progressIntervalRef.current = null;
					}
					advanceToNext();
				}, remaining);

				setIsPlaying(true);
			}
			return;
		}

		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			video.play().catch(() => {});
			setIsPlaying(true);
		} else {
			video.pause();
			setIsPlaying(false);
		}
	};

	const toggleMute = () => {
		const video = videoRef.current;
		if (!video) return;
		video.muted = !video.muted;
		setIsMuted(video.muted);
	};

	if (!current) return null;

	const item = current.item;
	const isPhoto = item.itemType === "PHOTOGRAPHY";
	const isExternalLink = item.itemType === "EXTERNAL_LINK";
	const isTimedSlide = isPhoto || isExternalLink;
	const entity = item.work || item.animation;
	const photo = item.photography;

	// Get display info
	const itemTitle = entity?.title || photo?.title || item.externalTitle || item.externalUrl || "";
	const itemSubtitle = (() => {
		if (item.work) {
			const parts: string[] = [];
			if (item.director) parts.push(item.director.title);
			if (item.work.clients.length) parts.push(item.work.clients[0]);
			return parts.join(" · ");
		}
		if (item.animation) {
			return item.animation.clients[0] || "";
		}
		if (item.photography) {
			return item.photography.photographer?.title || "";
		}
		if (isExternalLink) {
			return "";
		}
		return "";
	})();

	const nextTitle = (() => {
		if (!next) return "";
		const ni = next.item;
		return ni.work?.title || ni.animation?.title || ni.photography?.title || ni.externalTitle || "";
	})();

	// Photo/external link background image
	const photoUrl =
		photo?.images?.large ||
		photo?.images?.original ||
		item.externalThumbnail?.images?.large ||
		item.externalThumbnail?.images?.original ||
		"";

	const hasPrev = currentIndex > 0;
	const hasNext = !!next;

	return (
		<div className="fixed inset-0 bg-black" onMouseMove={resetControlsTimer} onClick={resetControlsTimer}>
			{/* Video layer */}
			{!isTimedSlide && (
				<video
					ref={videoRef}
					className="absolute inset-0 w-full h-full object-contain bg-black"
					playsInline
					muted={isMuted}
				/>
			)}

			{/* Photo layer */}
			{isPhoto && photoUrl && (
				<AnimatePresence mode="wait">
					<motion.div
						key={`photo-${currentIndex}`}
						initial={{ opacity: 0, scale: 1.05 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
						className="absolute inset-0 bg-cover bg-center bg-no-repeat"
						style={{ backgroundImage: `url(${photoUrl})` }}
					/>
				</AnimatePresence>
			)}

			{/* External Link layer */}
			{isExternalLink && (
				<AnimatePresence mode="wait">
					<motion.div
						key={`external-${currentIndex}`}
						initial={{ opacity: 0, scale: 1.05 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
						className="absolute inset-0 flex items-center justify-center"
						style={
							photoUrl
								? { backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
								: undefined
						}
					>
						{!photoUrl && <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />}
						<div className="relative z-10 flex flex-col items-center gap-6 p-8">
							<div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
								<svg
									width="28"
									height="28"
									viewBox="0 0 24 24"
									fill="none"
									stroke="white"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
									<polyline points="15 3 21 3 21 9" />
									<line x1="10" y1="14" x2="21" y2="3" />
								</svg>
							</div>
							{item.externalDescription && (
								<p className="text-white/70 text-sm text-center max-w-md">{item.externalDescription}</p>
							)}
							<a
								href={item.externalUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-sm font-medium hover:bg-white/20 transition-colors"
								onClick={(e) => e.stopPropagation()}
							>
								Open External Link
							</a>
						</div>
					</motion.div>
				</AnimatePresence>
			)}

			{/* Gradient overlays */}
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
				<div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/40 to-transparent" />
			</div>

			{/* Bottom info + controls */}
			<AnimatePresence>
				{showControls && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.3 }}
						className="absolute bottom-0 left-0 right-0 p-8 pb-10"
					>
						{/* Section label */}
						<p className="text-white/40 text-sm tracking-[3px] mb-2">{current.sectionTitle}</p>

						{/* Item title */}
						<h2 className="text-white text-3xl md:text-5xl font-light mb-2">{itemTitle}</h2>

						{/* Subtitle */}
						{itemSubtitle && <p className="text-white/60 text-md font-light mb-6">{itemSubtitle}</p>}

						{/* Controls row */}
						<div className="flex items-center justify-start gap-6">
							{/* Skip to prev */}
							<button
								onClick={() => onIndexChange(currentIndex - 1)}
								className={`text-white/70 hover:text-white transition-colors ${!hasPrev ? "opacity-50 pointer-events-none" : ""}`}
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ transform: "scaleX(-1)" }}>
									<polygon points="5,4 15,12 5,20" />
									<rect x="17" y="4" width="3" height="16" />
								</svg>
							</button>

							{/* Play/Pause */}
							<button onClick={togglePlayPause} className="text-white/70 hover:text-white transition-colors">
								{isPlaying ? (
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<rect x="6" y="4" width="4" height="16" />
										<rect x="14" y="4" width="4" height="16" />
									</svg>
								) : (
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<polygon points="5,3 19,12 5,21" />
									</svg>
								)}
							</button>

							{/* Skip to next */}
							<button
								onClick={advanceToNext}
								className={`text-white/70 hover:text-white transition-colors ${!hasNext ? "opacity-50 pointer-events-none" : ""}`}
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
									<polygon points="5,4 15,12 5,20" />
									<rect x="17" y="4" width="3" height="16" />
								</svg>
							</button>

							{/* Mute */}
							<button
								onClick={toggleMute}
								className={`text-white/70 hover:text-white transition-colors ${isTimedSlide ? "opacity-0 pointer-events-none" : ""}`}
							>
								{isMuted ? (
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
										<line x1="23" y1="9" x2="17" y2="15" />
										<line x1="17" y1="9" x2="23" y2="15" />
									</svg>
								) : (
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
										<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
										<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
									</svg>
								)}
							</button>
						</div>

						{/* Progress bar */}
						<div className="mt-4 h-[2px] bg-white/10 rounded-full overflow-hidden">
							<motion.div
								className="h-full bg-white/60"
								style={{ width: `${progress}%` }}
								transition={{ duration: 0.1 }}
							/>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Up Next card */}
			<AnimatePresence>
				{showUpNext && next && (
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 20 }}
						transition={{ duration: 0.4 }}
						className="absolute bottom-32 right-8 w-72 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-4 cursor-pointer"
						onClick={advanceToNext}
					>
						<p className="text-white/40 text-xs uppercase tracking-[2px] mb-2">Up Next</p>
						<div className="flex items-center gap-3">
							{/* Thumbnail */}
							{(() => {
								const ni = next.item;
								const thumb =
									ni.work?.images?.thumbnail ||
									ni.animation?.images?.thumbnail ||
									ni.photography?.images?.thumbnail ||
									ni.externalThumbnail?.images?.thumbnail;
								return thumb ? (
									<img src={thumb} alt="" className="w-16 h-10 object-cover rounded" />
								) : (
									<div className="w-16 h-10 bg-white/10 rounded" />
								);
							})()}
							<div className="flex-1 min-w-0">
								<p className="text-white text-md font-light truncate">{nextTitle}</p>
								<p className="text-white/40 text-sm truncate">{next.sectionTitle}</p>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
