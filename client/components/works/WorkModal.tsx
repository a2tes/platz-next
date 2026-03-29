"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";
import {
	IconArrowsDiagonal2,
	IconInfoCircle,
	IconPlayerPlayFilled,
	IconPlayerPauseFilled,
	IconX,
} from "@tabler/icons-react";

interface Work {
	title: string;
	slug: string;
	client: string;
	shortDescription: string;
	subtitle?: string;
	caseStudy?: string;
	starring: string;
	directors?: Array<{ title: string; slug?: string }>;
	videoUrl: string;
	hlsUrl?: string;
	optimizedVideoUrl?: string;
	videoThumbnailUrl: string;
}

export interface CardRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

interface WorkModalProps {
	work: Work | null;
	cardRect: CardRect | null;
	onClose: () => void;
}

const MuteIcon = ({ isMuted }: { isMuted: boolean }) => {
	const pathRef = useRef<SVGPathElement>(null);

	useEffect(() => {
		if (!pathRef.current) return;

		const wavePath = "M-28 12 Q-23 2 -18 12 T-8 12 T2 12 T12 12 T22 12 T32 12";
		const flatPath = "M-28 12 Q-23 12 -18 12 T-8 12 T2 12 T12 12 T22 12 T32 12";

		pathRef.current.setAttribute("d", isMuted ? flatPath : wavePath);
	}, [isMuted]);

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path ref={pathRef} d="M-28 12 Q-23 2 -18 12 T-8 12 T2 12 T12 12 T22 12 T32 12">
				<animateTransform
					attributeName="transform"
					attributeType="XML"
					type="translate"
					from="20 0"
					to="0 0"
					dur="1s"
					repeatCount="indefinite"
				/>
			</path>
		</svg>
	);
};

export default function WorkModal({ work, cardRect, onClose }: WorkModalProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const progressBarRef = useRef<HTMLInputElement>(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [showVideo, setShowVideo] = useState(false);
	const [isInfoVisible, setIsInfoVisible] = useState(true);
	const [mounted, setMounted] = useState(false);
	const [visibleDetailIndex, setVisibleDetailIndex] = useState(0);
	const hideInfoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const rotateDetailsIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// Handle client-side mounting for portal
	useEffect(() => {
		setMounted(true);
	}, []);

	// Lock body scroll when modal is open
	useEffect(() => {
		if (work) {
			document.body.style.overflow = "hidden";
			// Show video after layout animation completes (0.5s) + small delay
			const videoTimeout = setTimeout(() => {
				setShowVideo(true);
			}, 600);

			// Auto-hide info after 5 seconds
			hideInfoTimeoutRef.current = setTimeout(() => {
				setIsInfoVisible(false);
			}, 5000);

			// Rotate details every 3 seconds
			rotateDetailsIntervalRef.current = setInterval(() => {
				const detailsCount = [work.client, work.directors?.length, work.starring].filter(Boolean).length;
				setVisibleDetailIndex((prev) => (prev + 1) % detailsCount);
			}, 5000);

			return () => {
				// Always restore scroll on cleanup
				document.body.style.overflow = "";
				clearTimeout(videoTimeout);
				if (hideInfoTimeoutRef.current) {
					clearTimeout(hideInfoTimeoutRef.current);
				}
				if (rotateDetailsIntervalRef.current) {
					clearInterval(rotateDetailsIntervalRef.current);
				}
			};
		} else {
			document.body.style.overflow = "";
			setShowVideo(false);
			setIsPlaying(false);
			setIsInfoVisible(true);
			setVisibleDetailIndex(0);
		}
	}, [work]);

	// Video playback when video is shown - with HLS support
	useEffect(() => {
		const video = videoRef.current;
		if (!showVideo || !video || !work) return;

		// Determine best video source: HLS > Optimized MP4 > Original
		const hlsUrl = work.hlsUrl;
		const mp4Url = work.optimizedVideoUrl || work.videoUrl;

		// Cleanup function for HLS
		const cleanup = () => {
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
		};

		// Try HLS first if available
		if (hlsUrl && Hls.isSupported()) {
			cleanup();
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
				video.loop = true;
				video.play();
				setIsPlaying(true);
			});

			hls.on(Hls.Events.ERROR, (_event, data) => {
				if (data.fatal) {
					console.warn("[WorkModal] HLS error, falling back to MP4:", data);
					cleanup();
					// Fallback to MP4
					if (mp4Url) {
						video.src = mp4Url;
						video.loop = true;
						video.play();
						setIsPlaying(true);
					}
				}
			});
		} else if (hlsUrl && video.canPlayType("application/vnd.apple.mpegurl")) {
			// Native HLS support (Safari)
			video.src = hlsUrl;
			video.loop = true;
			video.play();
			setIsPlaying(true);
		} else if (mp4Url) {
			// Fallback to MP4
			video.src = mp4Url;
			video.loop = true;
			video.play();
			setIsPlaying(true);
		}

		return cleanup;
	}, [showVideo, work]);

	// Video progress tracking
	useEffect(() => {
		const video = videoRef.current;
		const progress = progressBarRef.current;

		const handleTimeUpdate = () => {
			if (video && progress) {
				const percentage = (video.currentTime / video.duration) * 100;
				progress.value = String(percentage);
			}
		};

		const handleProgressInput = () => {
			if (video && progress) {
				const time = (Number(progress.value) / 100) * video.duration;
				video.currentTime = time;
			}
		};

		if (video && progress) {
			video.addEventListener("timeupdate", handleTimeUpdate);
			progress.addEventListener("input", handleProgressInput);
		}

		return () => {
			if (video && progress) {
				video.removeEventListener("timeupdate", handleTimeUpdate);
				progress.removeEventListener("input", handleProgressInput);
			}
		};
	}, [showVideo]);

	// Keyboard handler
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleClose = () => {
		// Cleanup HLS instance
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}
		if (videoRef.current) {
			videoRef.current.pause();
			videoRef.current.src = "";
		}
		setShowVideo(false);
		setIsPlaying(false);
		onClose();
	};

	const togglePlayPause = () => {
		if (!videoRef.current) return;
		if (isPlaying) {
			videoRef.current.pause();
			setIsPlaying(false);
		} else {
			videoRef.current.play();
			setIsPlaying(true);
		}
	};

	const toggleMute = () => {
		if (!videoRef.current) return;
		const newMuted = !isMuted;
		setIsMuted(newMuted);
		videoRef.current.muted = newMuted;
	};

	const toggleInfo = () => {
		setIsInfoVisible(!isInfoVisible);
		if (hideInfoTimeoutRef.current) {
			clearTimeout(hideInfoTimeoutRef.current);
		}
	};

	const requestFullscreen = () => {
		if (videoRef.current) {
			if (videoRef.current.requestFullscreen) {
				videoRef.current.requestFullscreen();
			} else if ((videoRef.current as any).webkitRequestFullscreen) {
				(videoRef.current as any).webkitRequestFullscreen();
			}
		}
	};

	if (!mounted || !work || !cardRect) return null;

	return createPortal(
		<>
			{/* Backdrop */}
			<motion.div
				key={`modal-backdrop-${work.slug}`}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.4 }}
				className="fixed inset-0 bg-black z-50"
				onClick={handleClose}
			/>

			{/* Modal content - animates from card position to fullscreen */}
			<motion.div
				key={`modal-content-${work.slug}`}
				initial={{
					position: "fixed",
					top: cardRect.top,
					left: cardRect.left,
					width: cardRect.width,
					height: cardRect.height,
					zIndex: 51,
				}}
				animate={{
					top: 0,
					left: 0,
					width: "100vw",
					height: "100vh",
				}}
				exit={{
					top: cardRect.top,
					left: cardRect.left,
					width: cardRect.width,
					height: cardRect.height,
					opacity: 0,
				}}
				transition={{
					type: "spring",
					stiffness: 300,
					damping: 30,
				}}
				className="overflow-hidden bg-black"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Empty background during transition - video loads after animation */}

				{/* Video overlay - fades in after image animation */}
				<AnimatePresence>
					{showVideo && (
						<motion.video
							ref={videoRef}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.5 }}
							className="absolute inset-0 w-full h-full object-cover"
							playsInline
						/>
					)}
				</AnimatePresence>

				{/* Info Panel */}
				<AnimatePresence>
					{isInfoVisible && (
						<motion.div
							initial={{ opacity: 0, y: 20, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{
								opacity: 0,
								scale: 0.1,
								x: 20,
								y: 20,
								transition: { duration: 0.3 },
							}}
							transition={{ duration: 0.3 }}
							className="fixed bottom-8 left-0 w-full px-2 md:px-8 py-6 md:py-8 flex items-end"
							style={{ transformOrigin: "left bottom" }}
						>
							<div className="w-full md:max-w-3xl text-white">
								<motion.h2
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.1 }}
									className="text-2xl md:text-4xl font-bold mb-2"
								>
									{work.title}
								</motion.h2>
								{work.shortDescription && (
									<motion.p
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.15 }}
										className="mb-4 max-w-lg text-sm md:text-base text-gray-100"
									>
										{work.shortDescription}
									</motion.p>
								)}
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.2 }}
									className="flex flex-col sm:flex-row gap-4 md:gap-8"
								>
									{/* Desktop: show all items */}

									{work.client && (
										<div className="hidden md:block">
											<div>
												<span className="uppercase text-gray-200 text-xs md:text-sm">CLIENT</span>
												<p className="text-sm md:text-base">{work.client}</p>
											</div>
										</div>
									)}

									{work.directors && work.directors.length > 0 && (
										<div className="hidden md:block">
											<div>
												<span className="uppercase text-gray-200 text-xs md:text-sm">DIRECTOR</span>
												<p className="text-sm md:text-base">
													{work.directors.map((d, i) => (
														<span key={d.slug || d.title}>
															{i > 0 && ", "}
															{d.slug ? (
																<a
																	href={`/directors/${d.slug}`}
																	className="underline hover:text-gray-300 transition-colors"
																	onClick={(e) => e.stopPropagation()}
																>
																	{d.title}
																</a>
															) : (
																d.title
															)}
														</span>
													))}
												</p>
											</div>
										</div>
									)}

									{work.starring && (
										<div className="hidden md:block">
											<div>
												<span className="uppercase text-gray-200 text-xs md:text-sm">STARRING</span>
												<p className="text-sm md:text-base">{work.starring}</p>
											</div>
										</div>
									)}

									{/* Mobile: show rotating items */}
									<div className="block md:hidden relative min-h-[4rem]">
										{(() => {
											const details = [
												work.client && { key: "client", label: "CLIENT", value: work.client },

												work.directors &&
													work.directors.length > 0 && {
														key: "director",
														label: "DIRECTOR",
														directors: work.directors,
													},
												work.starring && { key: "starring", label: "STARRING", value: work.starring },
											].filter(Boolean) as {
												key: string;
												label: string;
												value?: string;
												directors?: Array<{ title: string; slug?: string }>;
											}[];

											const currentDetail = details[visibleDetailIndex % details.length];
											if (!currentDetail) return null;

											return (
												<AnimatePresence mode="wait">
													<motion.div
														key={currentDetail.key}
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -10 }}
														transition={{ duration: 0.5 }}
														className="absolute"
													>
														<span className="uppercase text-gray-200 text-xs md:text-sm">{currentDetail.label}</span>
														<p className="text-sm md:text-base">
															{currentDetail.directors
																? currentDetail.directors.map((d, i) => (
																		<span key={d.slug || d.title}>
																			{i > 0 && ", "}
																			{d.slug ? (
																				<a
																					href={`/directors/${d.slug}`}
																					className="underline hover:text-gray-300 transition-colors"
																					onClick={(e) => e.stopPropagation()}
																				>
																					{d.title}
																				</a>
																			) : (
																				d.title
																			)}
																		</span>
																	))
																: currentDetail.value}
														</p>
													</motion.div>
												</AnimatePresence>
											);
										})()}
									</div>
								</motion.div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Player Controls */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.6 }}
					className="player"
				>
					{/* Info Icon */}
					<motion.div
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.5 }}
						className="bg-black/20 text-gray-300 backdrop-blur-sm pl-2 md:pl-8 rounded-full flex items-center justify-center cursor-pointer"
						onClick={toggleInfo}
					>
						<IconInfoCircle className={isInfoVisible ? "" : "animate-ping-custom"} />
					</motion.div>
					<div className="player-controls">
						<div onClick={togglePlayPause} className="cursor-pointer">
							{isPlaying ? <IconPlayerPauseFilled className="w-6 h-6" /> : <IconPlayerPlayFilled className="w-6 h-6" />}
						</div>
						<div className="flex-1">
							<input ref={progressBarRef} type="range" min="0" max="100" defaultValue="0" id="progressBar" />
						</div>
						<div onClick={toggleMute} className="max-w-4 overflow-hidden cursor-pointer">
							<MuteIcon isMuted={isMuted} />
						</div>
						<div onClick={requestFullscreen} className="cursor-pointer hidden md:block">
							<IconArrowsDiagonal2 className="w-6 h-6" />
						</div>
					</div>
					<div className="pr-2 md:pr-8 w-10 hidden md:block"></div>
				</motion.div>

				{/* Close Button */}
				<motion.button
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.3 }}
					onClick={handleClose}
					className="absolute top-0 right-0 text-white/60 hover:text-white transition-colors p-8 cursor-pointer"
				>
					<IconX className="w-6 h-6" />
				</motion.button>
			</motion.div>
		</>,
		document.body,
	);
}
