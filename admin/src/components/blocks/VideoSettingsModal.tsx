"use client";

import * as React from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RangeSlider } from "@/components/ui/slider";
import { IconX, IconZoomIn, IconZoomOut, IconPlayerPlay, IconPlayerPause, IconCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { MediaService, type ExistingClip } from "@/services/mediaService";

interface CropSettings {
	x: number;
	y: number;
	width: number;
	height: number;
	aspect: number;
	aspectLabel?: string;
}

interface TrimSettings {
	startTime: number;
	endTime: number;
}

interface VideoSettingsModalProps {
	mode?: "clip" | "thumbnail";
	mediaUrl: string;
	cropSettings?: CropSettings;
	trimSettings?: TrimSettings;
	sourceMediaId?: number;
	onCancel: () => void;
	onSave: (settings: { cropSettings?: CropSettings; trimSettings?: TrimSettings }) => void;
	onSelectExistingClip?: (clip: ExistingClip) => void;
}

// Preset aspect ratios
const ASPECT_PRESETS = [
	{ label: "Ultra Widescreen (21:9)", value: 21 / 9 },
	{ label: "Standard Widescreen (16:9)", value: 16 / 9 },
	{ label: "Poster (5:4)", value: 5 / 4 },
	{ label: "Classic (4:3)", value: 4 / 3 },
	{ label: "Photo (3:2)", value: 3 / 2 },
	{ label: "Modern Cinematic (2:1)", value: 2 / 1 },
	{ label: "Square (1:1)", value: 1 },
	{ label: "Portrait Photo (2:3)", value: 2 / 3 },
	{ label: "Classic Portrait (3:4)", value: 3 / 4 },
	{ label: "Social Portrait (4:5)", value: 4 / 5 },
	{ label: "Story / Reel (9:16)", value: 9 / 16 },
	{ label: "Vertical Poster (1:2)", value: 1 / 2 },
	{ label: "Freeform", value: 0 },
];

// Snap a stored aspect ratio to the nearest preset to avoid floating point drift
function snapToPreset(value: number): number {
	for (const preset of ASPECT_PRESETS) {
		if (preset.value !== 0 && Math.abs(value - preset.value) < 0.01) {
			return preset.value;
		}
	}
	return value;
}

// Format seconds to MM:SS.ms
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const ms = Math.floor((seconds % 1) * 100);
	return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function VideoSettingsModal({
	mode = "clip",
	mediaUrl,
	cropSettings: initialCropSettings,
	trimSettings: initialTrimSettings,
	sourceMediaId,
	onCancel,
	onSave,
	onSelectExistingClip,
}: VideoSettingsModalProps) {
	const videoRef = React.useRef<HTMLVideoElement>(null);
	const videoContainerRef = React.useRef<HTMLDivElement>(null);

	// Fetch existing clips for this media
	const { data: existingClips } = useQuery({
		queryKey: ["existing-clips", sourceMediaId],
		queryFn: () => MediaService.getClipsByMediaId(sourceMediaId!),
		enabled: !!sourceMediaId && mode === "clip",
	});

	const hasExistingClips = !!(existingClips && existingClips.length > 0);
	const [activeTab, setActiveTab] = React.useState<"crop-trim" | "existing-clips">("crop-trim");
	const [selectedClip, setSelectedClip] = React.useState<ExistingClip | null>(null);

	// Video metadata
	const [videoDuration, setVideoDuration] = React.useState(0);
	const [videoSize, setVideoSize] = React.useState({ width: 0, height: 0 });
	const [isPlaying, setIsPlaying] = React.useState(false);
	const [currentTime, setCurrentTime] = React.useState(0);

	// Crop state - using react-image-crop format
	// Initialize crop immediately from initial settings so overlay is visible from the start
	const [crop, setCrop] = React.useState<Crop | undefined>(
		initialCropSettings
			? {
					unit: "%",
					x: initialCropSettings.x,
					y: initialCropSettings.y,
					width: initialCropSettings.width,
					height: initialCropSettings.height,
				}
			: undefined,
	);
	const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
	const [aspect, setAspect] = React.useState<number | undefined>(
		initialCropSettings
			? initialCropSettings.aspect === 0
				? undefined
				: snapToPreset(initialCropSettings.aspect)
			: 16 / 9,
	);

	// Trim state - in thumbnail mode, trimRange[0] and [1] are the same (single cursor)
	const [trimRange, setTrimRange] = React.useState<[number, number]>([
		initialTrimSettings?.startTime || 0,
		initialTrimSettings?.endTime || 0,
	]);
	const [lastActiveHandle, setLastActiveHandle] = React.useState<"start" | "end">("start");

	// Timeline zoom state (1 = full video, higher = more zoomed in)
	const [timelineZoom, setTimelineZoom] = React.useState(1);
	const [timelineOffset, setTimelineOffset] = React.useState(0); // in seconds
	const timelineRef = React.useRef<HTMLDivElement>(null);
	const sliderRef = React.useRef<HTMLDivElement>(null);
	const draggingHandleRef = React.useRef<"start" | "end" | null>(null);
	const isScrubbingRef = React.useRef(false);

	// Keep isPlaying in ref for loop check
	const isPlayingRef = React.useRef(isPlaying);
	const lastActiveHandleRef = React.useRef(lastActiveHandle);
	React.useEffect(() => {
		lastActiveHandleRef.current = lastActiveHandle;
	}, [lastActiveHandle]);

	React.useEffect(() => {
		isPlayingRef.current = isPlaying;
		// Pause/play video based on state
		if (videoRef.current) {
			if (isPlaying) {
				// Start from current cursor position when playing
				videoRef.current.play().catch(() => {});
			} else {
				videoRef.current.pause();
				// Don't seek when pausing for scrub — let cursor control position
				if (!isScrubbingRef.current) {
					if (lastActiveHandleRef.current === "end") {
						videoRef.current.currentTime = trimRangeRef.current[1];
					} else {
						videoRef.current.currentTime = trimRangeRef.current[0];
					}
				}
			}
		}
	}, [isPlaying]);

	// Keep trimRange in a ref for the timeupdate handler
	const trimRangeRef = React.useRef(trimRange);
	React.useEffect(() => {
		trimRangeRef.current = trimRange;
	}, [trimRange]);

	// Effect to handle video looping within trim range
	React.useEffect(() => {
		const video = videoRef.current;
		if (!video || videoDuration === 0) return;

		let animationId: number;

		const checkTime = () => {
			if (!video) return;

			// Update current time for playhead
			setCurrentTime(video.currentTime);

			// Don't loop while video is paused
			if (!isPlayingRef.current) {
				animationId = requestAnimationFrame(checkTime);
				return;
			}

			const [start, end] = trimRangeRef.current;

			// Loop back to start if we've passed the end
			if (video.currentTime >= end - 0.1) {
				video.currentTime = start;
			}

			animationId = requestAnimationFrame(checkTime);
		};

		animationId = requestAnimationFrame(checkTime);

		return () => {
			cancelAnimationFrame(animationId);
		};
	}, [videoDuration]);

	// Helper function to create maximum size crop for given aspect ratio
	const createMaxCrop = (targetAspect: number, mediaWidth: number, mediaHeight: number): Crop => {
		const mediaAspect = mediaWidth / mediaHeight;

		let cropWidth: number;
		let cropHeight: number;

		if (targetAspect > mediaAspect) {
			// Crop is wider than media - fill width, calculate height
			cropWidth = 100;
			cropHeight = (mediaAspect / targetAspect) * 100;
		} else {
			// Crop is taller than media - fill height, calculate width
			cropHeight = 100;
			cropWidth = (targetAspect / mediaAspect) * 100;
		}

		return centerCrop(
			{
				unit: "%",
				width: cropWidth,
				height: cropHeight,
			},
			mediaWidth,
			mediaHeight,
		);
	};

	// Initialize crop when video loads
	const onVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
		const video = e.currentTarget;
		videoRef.current = video;

		const { videoWidth, videoHeight, duration } = video;
		setVideoSize({ width: videoWidth, height: videoHeight });
		setVideoDuration(duration);

		if (!initialTrimSettings) {
			setTrimRange([0, duration]);
		}

		// Set initial crop
		if (initialCropSettings && videoWidth > 0 && videoHeight > 0) {
			// cropSettings are already stored as percentages (0-100)
			setCrop({
				unit: "%",
				x: initialCropSettings.x,
				y: initialCropSettings.y,
				width: initialCropSettings.width,
				height: initialCropSettings.height,
			});
		} else if (aspect && videoWidth > 0 && videoHeight > 0) {
			// Create maximum size centered crop with aspect ratio
			setCrop(createMaxCrop(aspect, videoWidth, videoHeight));
		}

		// Video starts paused
		video.muted = true;
		video.loop = false;
		const initialTime = initialTrimSettings?.startTime || 0;
		video.currentTime = initialTime;
		setCurrentTime(initialTime);
		video.pause();
	};

	// Handle aspect ratio change
	const handleAspectChange = (newAspect: number) => {
		const newAspectValue = newAspect === 0 ? undefined : newAspect;
		setAspect(newAspectValue);

		// If there's an aspect ratio and video is loaded, create a new maximum size centered crop
		if (newAspectValue && videoSize.width > 0 && videoSize.height > 0) {
			setCrop(createMaxCrop(newAspectValue, videoSize.width, videoSize.height));
		}
	};

	// Handle trim range change
	const handleTrimChange = (values: [number, number], seekToEnd?: boolean) => {
		setTrimRange(values);

		// Use the dragging handle ref to determine which handle is active
		const activeHandle = seekToEnd ? "end" : draggingHandleRef.current || "start";

		// Update last active handle
		setLastActiveHandle(activeHandle);

		// Seek video to the active handle position
		if (videoRef.current) {
			if (activeHandle === "end") {
				videoRef.current.currentTime = values[1];
			} else {
				videoRef.current.currentTime = values[0];
			}
		}
	};

	// Determine which handle is being clicked based on pointer position
	const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!sliderRef.current) return;

		const rect = sliderRef.current.getBoundingClientRect();
		const clickPercent = (e.clientX - rect.left) / rect.width;
		const visibleDuration = videoDuration / timelineZoom;
		const clickTime = timelineOffset + clickPercent * visibleDuration;

		// Determine which handle is closer to the click
		const distToStart = Math.abs(clickTime - trimRange[0]);
		const distToEnd = Math.abs(clickTime - trimRange[1]);

		draggingHandleRef.current = distToEnd < distToStart ? "end" : "start";
	};

	const handleSliderPointerUp = () => {
		draggingHandleRef.current = null;
	};

	// Save settings
	const handleSave = () => {
		const settings: { cropSettings?: CropSettings; trimSettings?: TrimSettings } = {};

		// Use current crop, or generate a default max crop from aspect ratio if none was drawn
		let cropToSave = crop;
		if (
			(!cropToSave || cropToSave.width === 0 || cropToSave.height === 0) &&
			aspect &&
			videoSize.width > 0 &&
			videoSize.height > 0
		) {
			cropToSave = createMaxCrop(aspect, videoSize.width, videoSize.height);
		}

		// Save crop as percentages (0-100) for consistent display at any size
		if (cropToSave && cropToSave.width > 0 && cropToSave.height > 0) {
			const currentAspect = aspect || 0;
			const matchedPreset = ASPECT_PRESETS.find((p) => p.value !== 0 && Math.abs(currentAspect - p.value) < 0.01);
			settings.cropSettings = {
				x: cropToSave.x,
				y: cropToSave.y,
				width: cropToSave.width,
				height: cropToSave.height,
				aspect: currentAspect,
				aspectLabel: matchedPreset ? matchedPreset.label : "Freeform",
			};
		}

		if (mode === "thumbnail") {
			// Thumbnail mode: save current playhead position as frameTime
			settings.trimSettings = {
				startTime: currentTime,
				endTime: currentTime,
			};
		} else {
			// Clip mode: save trim range if different from full video
			if (trimRange[0] > 0 || trimRange[1] < videoDuration) {
				settings.trimSettings = {
					startTime: trimRange[0],
					endTime: trimRange[1],
				};
			}
		}

		onSave(settings);
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onCancel()}>
			<DialogContent className="sm:max-w-5xl p-0 overflow-hidden">
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<DialogTitle>{mode === "thumbnail" ? "Thumbnail Settings" : "Video Settings"}</DialogTitle>
							{hasExistingClips && (
								<div className="flex items-center gap-1">
									<button
										type="button"
										className={`px-3 py-1 text-sm rounded-md transition-colors ${
											activeTab === "crop-trim"
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:text-foreground hover:bg-muted"
										}`}
										onClick={() => setActiveTab("crop-trim")}
									>
										Crop &amp; Trim
									</button>
									<button
										type="button"
										className={`px-3 py-1 text-sm rounded-md transition-colors ${
											activeTab === "existing-clips"
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:text-foreground hover:bg-muted"
										}`}
										onClick={() => setActiveTab("existing-clips")}
									>
										Existing Clips ({existingClips!.length})
									</button>
								</div>
							)}
						</div>
						<Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>

				{activeTab === "crop-trim" ? (
					<>
						<div className="flex flex-col">
							{/* Main content: Video + Settings panel */}
							<div className="flex">
								{/* Video Cropper - Left side */}
								<div
									ref={videoContainerRef}
									className="relative flex-1 h-[45vh] bg-black flex items-center justify-center overflow-hidden"
								>
									<ReactCrop
										crop={crop}
										onChange={(_, percentCrop) => setCrop(percentCrop)}
										onComplete={(c) => setCompletedCrop(c)}
										aspect={aspect}
										style={{ maxHeight: "100%", maxWidth: "100%" }}
									>
										<video
											src={mediaUrl}
											onLoadedMetadata={onVideoLoad}
											style={{ maxHeight: "45vh", maxWidth: "100%", display: "block" }}
											muted
										/>
									</ReactCrop>
								</div>

								{/* Settings Panel - Right side */}
								<div className="w-72 border-l bg-muted/30 p-4 space-y-4 overflow-y-auto max-h-[45vh]">
									{/* Aspect Ratio Presets */}
									<div className="flex flex-col space-y-2">
										<span className="text-sm font-medium">Aspect Ratio</span>
										<div className="flex flex-col gap-1">
											{ASPECT_PRESETS.map((preset) => (
												<Button
													key={preset.label}
													variant={
														(preset.value === 0 && aspect === undefined) ||
														(preset.value !== 0 && aspect !== undefined && Math.abs(aspect - preset.value) < 0.01)
															? "default"
															: "outline"
													}
													size="sm"
													onClick={() => handleAspectChange(preset.value)}
													className="w-full justify-start text-xs h-7"
												>
													{preset.label}
												</Button>
											))}
										</div>
									</div>
								</div>
							</div>

							{/* Timeline Trim Section - Below */}
							<div className="border-t p-4 pb-6 space-y-3">
								{/* Header with time info and zoom controls */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium">{mode === "thumbnail" ? "Select Frame" : "Timeline"}</span>
										{mode === "thumbnail" ? (
											<span className="text-xs text-muted-foreground">
												<span className="font-mono">{formatTime(currentTime)}</span>
												<span className="ml-2 text-muted-foreground/60">/ {formatTime(videoDuration)}</span>
											</span>
										) : (
											<span className="text-xs text-muted-foreground">
												<span className="font-mono">{formatTime(trimRange[0])}</span> -{" "}
												<span className="font-mono">{formatTime(trimRange[1])}</span>
												<span className="ml-2">({formatTime(trimRange[1] - trimRange[0])})</span>
											</span>
										)}
									</div>
									<div className="flex items-center gap-2">
										{/* Play/Pause toggle */}
										<Button
											variant="outline"
											size="icon"
											className="h-7 w-7"
											onClick={() => setIsPlaying(!isPlaying)}
											title={isPlaying ? "Pause video" : "Play video"}
										>
											{isPlaying ? <IconPlayerPause className="h-4 w-4" /> : <IconPlayerPlay className="h-4 w-4" />}
										</Button>

										<div className="w-px h-5 bg-border" />

										{/* Zoom controls */}
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7"
											onClick={() => {
												setTimelineZoom(Math.max(1, timelineZoom - 1));
												if (timelineZoom <= 2) setTimelineOffset(0);
											}}
											disabled={timelineZoom <= 1}
										>
											<IconZoomOut className="h-4 w-4" />
										</Button>
										<span className="text-xs text-muted-foreground w-8 text-center">{timelineZoom}x</span>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7"
											onClick={() => {
												const newZoom = Math.min(10, timelineZoom + 1);
												setTimelineZoom(newZoom);
												// Center on trim start when zooming in
												const visibleDuration = videoDuration / newZoom;
												const idealOffset = trimRange[0] - visibleDuration * 0.2;
												const maxOffset = videoDuration - visibleDuration;
												setTimelineOffset(Math.max(0, Math.min(maxOffset, idealOffset)));
											}}
											disabled={timelineZoom >= 10}
										>
											<IconZoomIn className="h-4 w-4" />
										</Button>
									</div>
								</div>

								{/* Timeline Container */}
								<div className="relative pt-2">
									{/* Timeline Track with drag support */}
									<div ref={timelineRef} className="relative h-12 bg-muted/50 rounded-lg overflow-hidden">
										{/* Drag/scroll area - only visible part without handles */}
										<div
											className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
											style={{ left: "16px", right: "16px", width: "auto" }}
											onMouseDown={(e) => {
												if (timelineZoom <= 1) return;
												e.preventDefault();
												e.stopPropagation();
												const startX = e.clientX;
												const startOffset = timelineOffset;
												const visibleDuration = videoDuration / timelineZoom;
												const maxOffset = videoDuration - visibleDuration;
												const rect = timelineRef.current?.getBoundingClientRect();
												if (!rect) return;

												const handleMouseMove = (moveEvent: MouseEvent) => {
													const deltaX = startX - moveEvent.clientX;
													const deltaTime = (deltaX / rect.width) * visibleDuration;
													setTimelineOffset(Math.max(0, Math.min(maxOffset, startOffset + deltaTime)));
												};

												const handleMouseUp = () => {
													document.removeEventListener("mousemove", handleMouseMove);
													document.removeEventListener("mouseup", handleMouseUp);
												};

												document.addEventListener("mousemove", handleMouseMove);
												document.addEventListener("mouseup", handleMouseUp);
											}}
											onWheel={(e) => {
												if (timelineZoom > 1) {
													e.preventDefault();
													const visibleDuration = videoDuration / timelineZoom;
													const maxOffset = videoDuration - visibleDuration;
													const delta = (e.deltaX || e.deltaY) * 0.01 * visibleDuration;
													setTimelineOffset(Math.max(0, Math.min(maxOffset, timelineOffset + delta)));
												}
											}}
										/>
										{/* Timeline ticks */}
										<div className="absolute inset-0 flex items-end pb-1 pointer-events-none">
											{videoDuration > 0 &&
												(() => {
													const visibleDuration = videoDuration / timelineZoom;
													const visibleEnd = timelineOffset + visibleDuration;
													// Calculate tick interval based on zoom level
													const tickInterval = Math.max(0.1, 1 / timelineZoom);
													const ticks = [];
													// Start from the first tick at or after timelineOffset
													const firstTick = Math.ceil(timelineOffset / tickInterval) * tickInterval;
													for (
														let time = firstTick;
														time <= visibleEnd && time <= videoDuration;
														time += tickInterval
													) {
														const position = ((time - timelineOffset) / visibleDuration) * 100;
														if (position < 0 || position > 100) continue;
														// Major tick every 5 intervals or at whole seconds
														const isMajor = Math.abs(time - Math.round(time)) < 0.01;
														ticks.push(
															<div
																key={time.toFixed(3)}
																className="absolute flex flex-col items-center"
																style={{ left: `${position}%` }}
															>
																<div
																	className={`w-px ${isMajor ? "h-3 bg-muted-foreground/50" : "h-1.5 bg-muted-foreground/30"}`}
																/>
															</div>,
														);
													}
													return ticks;
												})()}
										</div>

										{/* Selected range highlight - draggable (clip mode only) */}
										{mode !== "thumbnail" &&
											videoDuration > 0 &&
											(() => {
												const visibleDuration = videoDuration / timelineZoom;
												const startPercent = Math.max(0, ((trimRange[0] - timelineOffset) / visibleDuration) * 100);
												const endPercent = Math.min(100, ((trimRange[1] - timelineOffset) / visibleDuration) * 100);

												return (
													<div
														className="absolute top-0 bottom-0 bg-primary/20 border-x-2 border-primary z-20"
														style={{
															left: `${startPercent}%`,
															width: `${endPercent - startPercent}%`,
															cursor: "default",
														}}
														onMouseDown={(e) => {
															const rect = e.currentTarget.getBoundingClientRect();
															const clickFraction = (e.clientX - rect.left) / rect.width;
															const clickTime = trimRange[0] + clickFraction * (trimRange[1] - trimRange[0]);

															e.preventDefault();
															e.stopPropagation();
															const clampedTime = Math.max(trimRange[0], Math.min(trimRange[1], clickTime));
															setCurrentTime(clampedTime);
															if (videoRef.current) {
																videoRef.current.currentTime = clampedTime;
															}
														}}
													/>
												);
											})()}

										{/* Thumbnail mode: clickable timeline to seek to any frame */}
										{mode === "thumbnail" && videoDuration > 0 && (
											<div
												className="absolute inset-0 z-20 cursor-crosshair"
												onMouseDown={(e) => {
													e.preventDefault();
													e.stopPropagation();
													const rect = e.currentTarget.getBoundingClientRect();
													const fraction = (e.clientX - rect.left) / rect.width;
													const visibleDuration = videoDuration / timelineZoom;
													const clickTime = Math.max(
														0,
														Math.min(videoDuration, timelineOffset + fraction * visibleDuration),
													);
													setCurrentTime(clickTime);
													if (videoRef.current) {
														videoRef.current.currentTime = clickTime;
														videoRef.current.pause();
													}
													setIsPlaying(false);
												}}
											/>
										)}
									</div>

									{/* Blue Playhead Cursor - rendered outside overflow-hidden so triangle shows above */}
									{videoDuration > 0 &&
										(() => {
											const visibleDuration = videoDuration / timelineZoom;
											const playheadPercent = ((currentTime - timelineOffset) / visibleDuration) * 100;
											const isPlayheadInRange =
												mode === "thumbnail" || (currentTime >= trimRange[0] && currentTime <= trimRange[1]);
											const isPlayheadVisible = playheadPercent >= 0 && playheadPercent <= 100;

											if (!isPlayheadVisible || !isPlayheadInRange) return null;

											return (
												<div
													className="absolute z-40 cursor-col-resize pointer-events-none"
													style={{
														left: `${playheadPercent}%`,
														transform: "translateX(-50%)",
														width: "14px",
														top: "0px",
														height: "calc(8px + 48px)" /* pt-2 (8px) + h-12 (48px) */,
													}}
												>
													{/* Triangle head - in the pt-3 padding above the timeline track */}
													<div
														className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto cursor-col-resize"
														style={{
															width: 0,
															height: 0,
															borderLeft: "6px solid transparent",
															borderRight: "6px solid transparent",
															borderTop: "8px solid #3b82f6",
														}}
														onMouseDown={(e) => {
															e.preventDefault();
															e.stopPropagation();

															const wasPlaying = isPlayingRef.current;
															isScrubbingRef.current = true;

															if (wasPlaying && videoRef.current) {
																videoRef.current.pause();
															}

															const timelineRect = timelineRef.current?.getBoundingClientRect();
															if (!timelineRect) return;

															const handleMouseMove = (moveEvent: MouseEvent) => {
																const fraction = (moveEvent.clientX - timelineRect.left) / timelineRect.width;
																const newTime = timelineOffset + fraction * visibleDuration;
																const clampedTime =
																	mode === "thumbnail"
																		? Math.max(0, Math.min(videoDuration, newTime))
																		: Math.max(trimRange[0], Math.min(trimRange[1], newTime));
																if (videoRef.current) {
																	videoRef.current.currentTime = clampedTime;
																}
																setCurrentTime(clampedTime);
															};

															const handleMouseUp = () => {
																document.removeEventListener("mousemove", handleMouseMove);
																document.removeEventListener("mouseup", handleMouseUp);
																isScrubbingRef.current = false;
																if (wasPlaying && videoRef.current) {
																	videoRef.current.play().catch(() => {});
																}
															};

															document.addEventListener("mousemove", handleMouseMove);
															document.addEventListener("mouseup", handleMouseUp);
														}}
													/>
													{/* Vertical line - from below triangle through track */}
													<div
														className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-blue-500 pointer-events-auto cursor-col-resize"
														style={{ top: "8px", bottom: "0px" }}
														onMouseDown={(e) => {
															e.preventDefault();
															e.stopPropagation();

															const wasPlaying = isPlayingRef.current;
															isScrubbingRef.current = true;

															if (wasPlaying && videoRef.current) {
																videoRef.current.pause();
															}

															const timelineRect = timelineRef.current?.getBoundingClientRect();
															if (!timelineRect) return;

															const handleMouseMove = (moveEvent: MouseEvent) => {
																const fraction = (moveEvent.clientX - timelineRect.left) / timelineRect.width;
																const newTime = timelineOffset + fraction * visibleDuration;
																const clampedTime =
																	mode === "thumbnail"
																		? Math.max(0, Math.min(videoDuration, newTime))
																		: Math.max(trimRange[0], Math.min(trimRange[1], newTime));
																setCurrentTime(clampedTime);
															};

															const handleMouseUp = () => {
																document.removeEventListener("mousemove", handleMouseMove);
																document.removeEventListener("mouseup", handleMouseUp);
																isScrubbingRef.current = false;
																if (wasPlaying && videoRef.current) {
																	videoRef.current.play().catch(() => {});
																}
															};

															document.addEventListener("mousemove", handleMouseMove);
															document.addEventListener("mouseup", handleMouseUp);
														}}
													/>
												</div>
											);
										})()}

									{/* Range Slider - below timeline for better interaction (clip mode only) */}
									{mode !== "thumbnail" && (
										<div
											ref={sliderRef}
											className="mt-2 relative"
											onPointerDown={handleSliderPointerDown}
											onPointerUp={handleSliderPointerUp}
											onPointerLeave={handleSliderPointerUp}
										>
											<RangeSlider
												min={timelineOffset}
												max={Math.min(videoDuration, timelineOffset + videoDuration / timelineZoom)}
												step={0.01}
												value={[
													Math.max(trimRange[0], timelineOffset),
													Math.min(trimRange[1], timelineOffset + videoDuration / timelineZoom),
												]}
												onValueChange={(values) => {
													const newRange: [number, number] = [
														Math.max(0, values[0]),
														Math.min(videoDuration, values[1]),
													];
													handleTrimChange(newRange);
												}}
												className="w-full"
											/>
											{/* Start and End time labels under handles */}
											{videoDuration > 0 &&
												(() => {
													const visibleDuration = videoDuration / timelineZoom;
													const startPercent = ((trimRange[0] - timelineOffset) / visibleDuration) * 100;
													const endPercent = ((trimRange[1] - timelineOffset) / visibleDuration) * 100;
													return (
														<>
															{startPercent >= 0 && startPercent <= 100 && (
																<div
																	className="absolute top-6 text-xs font-mono text-muted-foreground -translate-x-1/2"
																	style={{ left: `${startPercent}%` }}
																>
																	{formatTime(trimRange[0])}
																</div>
															)}
															{endPercent >= 0 && endPercent <= 100 && (
																<div
																	className="absolute top-6 text-xs font-mono text-muted-foreground -translate-x-1/2"
																	style={{ left: `${endPercent}%` }}
																>
																	{formatTime(trimRange[1])}
																</div>
															)}
														</>
													);
												})()}
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Footer */}
						<div className="px-6 py-4 border-t flex justify-end gap-2">
							<Button variant="outline" onClick={onCancel}>
								Cancel
							</Button>
							<Button onClick={handleSave}>{mode === "thumbnail" ? "Create Thumbnail" : "Apply Settings"}</Button>
						</div>
					</>
				) : (
					<>
						{/* Existing Clips Tab */}
						<div className="flex">
							{/* Video Preview - Left side */}
							<div className="relative flex-1 h-[45vh] bg-black flex items-center justify-center overflow-hidden">
								{selectedClip?.outputUrl ? (
									<video
										key={selectedClip.id}
										src={selectedClip.outputUrl}
										controls
										muted
										autoPlay
										loop
										style={{ maxHeight: "45vh", maxWidth: "100%", display: "block" }}
									/>
								) : (
									<span className="text-sm text-muted-foreground">Select a clip to preview</span>
								)}
							</div>

							{/* Clip List Panel - Right side */}
							<div className="w-72 border-l bg-muted/30 p-4 space-y-4 overflow-y-auto max-h-[45vh]">
								<div className="flex flex-col space-y-2">
									<span className="text-sm font-medium">Existing Clips</span>
									<div className="flex flex-col gap-2">
										{existingClips!.map((clip) => {
											const aspectLabel = clip.cropSettings
												? ASPECT_PRESETS.find(
														(p) => p.value !== 0 && Math.abs(p.value - clip.cropSettings!.aspect) < 0.01,
													)?.label || `${clip.cropSettings.aspect.toFixed(2)}`
												: "No crop";
											const trimLabel = clip.trimSettings
												? `${formatTime(clip.trimSettings.startTime)} – ${formatTime(clip.trimSettings.endTime)}`
												: "Full length";
											const isSelected = selectedClip?.id === clip.id;
											return (
												<button
													key={clip.id}
													type="button"
													className={`flex items-start gap-2 rounded-md border p-2 text-left transition-colors ${
														isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
													}`}
													onClick={() => setSelectedClip(clip)}
												>
													{clip.thumbnailUrl ? (
														<img
															src={clip.thumbnailUrl}
															alt=""
															className="w-16 h-10 object-cover rounded flex-shrink-0"
														/>
													) : (
														<div className="w-16 h-10 bg-muted rounded flex-shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
															No preview
														</div>
													)}
													<div className="flex-1 min-w-0">
														<p className="text-xs truncate">{aspectLabel}</p>
														<p className="text-[10px] text-muted-foreground truncate">{trimLabel}</p>
													</div>
													{isSelected && <IconCheck className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />}
												</button>
											);
										})}
									</div>
								</div>
							</div>
						</div>

						{/* Footer */}
						<div className="px-6 py-4 border-t flex justify-end gap-2">
							<Button variant="outline" onClick={onCancel}>
								Cancel
							</Button>
							<Button
								disabled={!selectedClip}
								onClick={() => {
									if (!selectedClip) return;
									onSelectExistingClip
										? onSelectExistingClip(selectedClip)
										: onSave({
												cropSettings: selectedClip.cropSettings ?? undefined,
												trimSettings: selectedClip.trimSettings ?? undefined,
											});
								}}
							>
								Use This Clip
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
