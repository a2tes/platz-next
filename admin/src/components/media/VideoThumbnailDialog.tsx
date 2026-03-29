import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MediaFile } from "@/services/mediaService";
import { Loader2, ImageIcon, AlertCircle } from "lucide-react";

interface VideoThumbnailDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	file: MediaFile;
	onSave: (thumbnailBlob: Blob, thumbnailTime: number) => Promise<void>;
}

interface ThumbnailFrame {
	time: number;
	timelineUrl: string; // Small thumbnail for timeline strip (320px)
	previewUrl: string; // Larger preview URL (1280px)
}

// ImageKit base URL (from environment or hardcoded)
const IMAGEKIT_BASE_URL = "https://ik.imagekit.io/platz";

/**
 * Extract path from CloudFront URL
 * CloudFront URL: https://xxx.cloudfront.net/processed/uuid/1080p.mp4
 * Returns: processed/uuid/1080p.mp4
 */
function extractPathFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url);
		// Remove leading slash
		return urlObj.pathname.replace(/^\//, "");
	} catch {
		return null;
	}
}

/**
 * Build ImageKit video thumbnail URL
 * ImageKit uses `so-{seconds}` parameter to extract a frame from video
 * Format: {imagekit_base}/{video_path}/ik-thumbnail.jpg?tr=so-{seconds},w-{width}
 */
function buildImageKitFrameUrl(videoPath: string, timeSeconds: number, width: number = 320): string {
	// Build transformation string
	const tr = `so-${timeSeconds},w-${width},q-80`;
	return `${IMAGEKIT_BASE_URL}/${videoPath}/ik-thumbnail.jpg?tr=${tr}`;
}

export function VideoThumbnailDialog({ open, onOpenChange, file, onSave }: VideoThumbnailDialogProps) {
	const [duration, setDuration] = React.useState<number>(0);
	const [selectedTime, setSelectedTime] = React.useState<number | null>(null);
	const [selectedFrame, setSelectedFrame] = React.useState<string | null>(null);
	const [isSaving, setIsSaving] = React.useState(false);
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [frames, setFrames] = React.useState<ThumbnailFrame[]>([]);
	const [error, setError] = React.useState<string | null>(null);
	const [initialThumbnailTime, setInitialThumbnailTime] = React.useState<number | null>(null);
	const [videoReady, setVideoReady] = React.useState(false);

	const videoRef = React.useRef<HTMLVideoElement>(null);
	const currentFileIdRef = React.useRef<number | null>(null);

	// Get video path for ImageKit frame extraction
	// Use optimized mp4 since original videos are deleted after processing
	const videoPathForFrames = React.useMemo(() => {
		const mp4Url = file.video?.mp4;
		if (mp4Url) {
			return extractPathFromUrl(mp4Url);
		}
		// Fallback to original path from provider URL
		const providerUrl = file.video?.provider;
		if (providerUrl) {
			return extractPathFromUrl(providerUrl);
		}
		return null;
	}, [file.video?.mp4, file.video?.provider]);

	// Get video source for duration detection only
	const videoSrc = React.useMemo(() => {
		const isHls = (url: string | undefined | null) => url?.includes(".m3u8");
		const mp4 = file.video?.mp4;
		const original = file.video?.original;
		const defaultUrl = file.video?.default;

		if (mp4 && !isHls(mp4)) return mp4;
		if (original && !isHls(original)) return original;
		if (defaultUrl && !isHls(defaultUrl)) return defaultUrl;
		return "";
	}, [file]);

	// Generate thumbnail times based on duration
	const thumbnailTimes = React.useMemo(() => {
		if (!duration) return [];
		const step = duration < 60 ? 1 : duration < 300 ? 5 : 10;
		const maxTime = Math.max(0, duration - 1); // Exclude last second
		const count = Math.floor(maxTime / step);
		const times: number[] = [];
		for (let i = 0; i <= count; i++) {
			times.push(i * step);
		}
		return times;
	}, [duration]);

	// Thumbnail dimensions for timeline (320px) and preview (1280px)
	const TIMELINE_THUMB_WIDTH = 320;
	const PREVIEW_THUMB_WIDTH = 1280;

	// Handle video metadata loaded - we only need duration
	const handleLoadedMetadata = () => {
		const video = videoRef.current;
		if (video) {
			setDuration(video.duration);
			setVideoReady(true);
		}
	};

	// Handle video error
	const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
		const video = e.currentTarget;
		console.error("[VideoThumbnailDialog] Video error:", video.error);
		setError(`Failed to load video metadata: ${video.error?.message || "Unknown error"}`);
		setVideoReady(false);
	};

	// Generate frames using ImageKit URLs (no canvas needed!)
	const generateFrames = React.useCallback(() => {
		if (!videoPathForFrames || thumbnailTimes.length === 0) return;
		if (frames.length > 0 || isGenerating) return;

		setIsGenerating(true);

		const generatedFrames: ThumbnailFrame[] = thumbnailTimes.map((time) => ({
			time,
			timelineUrl: buildImageKitFrameUrl(videoPathForFrames, time, TIMELINE_THUMB_WIDTH),
			previewUrl: buildImageKitFrameUrl(videoPathForFrames, time, PREVIEW_THUMB_WIDTH),
		}));

		setFrames(generatedFrames);
		setIsGenerating(false);

		// Set initial selection
		const initialTime = initialThumbnailTime ?? 0;
		const initialFrame = generatedFrames.find((f) => f.time === initialTime) || generatedFrames[0];
		if (initialFrame) {
			setSelectedTime(initialFrame.time);
			setSelectedFrame(initialFrame.previewUrl);
		}
	}, [
		videoPathForFrames,
		thumbnailTimes,
		frames.length,
		isGenerating,
		initialThumbnailTime,
		TIMELINE_THUMB_WIDTH,
		PREVIEW_THUMB_WIDTH,
	]);

	// Start frame generation when video duration is ready
	React.useEffect(() => {
		if (videoReady && open && videoPathForFrames && frames.length === 0 && !isGenerating) {
			generateFrames();
		}
	}, [videoReady, open, videoPathForFrames, frames.length, isGenerating, generateFrames]);

	// Handle frame selection
	const handleSelectFrame = (frame: ThumbnailFrame) => {
		setSelectedTime(frame.time);
		setSelectedFrame(frame.previewUrl);
	};

	// Fetch image from ImageKit and convert to Blob for saving
	const fetchImageAsBlob = async (url: string): Promise<Blob> => {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.statusText}`);
		}
		return response.blob();
	};

	// Handle save
	const handleSave = async () => {
		if (selectedTime === null || !selectedFrame) return;

		setIsSaving(true);
		try {
			const blob = await fetchImageAsBlob(selectedFrame);
			await onSave(blob, selectedTime);
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to save thumbnail:", error);
			setError("Failed to save thumbnail. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	// Reset state when dialog closes
	React.useEffect(() => {
		if (!open) {
			setFrames([]);
			setSelectedFrame(null);
			setSelectedTime(null);
			setError(null);
			setIsGenerating(false);
			setInitialThumbnailTime(null);
			setDuration(0);
			setVideoReady(false);
			currentFileIdRef.current = null;
		}
	}, [open]);

	// Handle file changes when dialog is open
	React.useEffect(() => {
		if (open) {
			if (currentFileIdRef.current !== null && currentFileIdRef.current !== file.id) {
				// File changed, reset state
				setFrames([]);
				setSelectedFrame(null);
				setSelectedTime(null);
				setError(null);
				setIsGenerating(false);
				setDuration(0);
				setVideoReady(false);
			}
			currentFileIdRef.current = file.id;
			setInitialThumbnailTime(file.thumbnailTime || null);
		}
	}, [open, file.id, file.thumbnailTime]);

	// Show existing thumbnail from file if available (before frames are generated)
	const existingThumbnail = file.images?.thumbnail || file.images?.small || file.images?.medium;
	const showLoadingState = !videoReady && !error && open && videoSrc;

	// Retry loading
	const handleRetryLoad = () => {
		setError(null);
		setVideoReady(false);
		setFrames([]);
		setSelectedFrame(null);
		setSelectedTime(null);
		setIsGenerating(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Set Video Thumbnail</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{!videoPathForFrames && (
						<div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>No video URL available for thumbnail extraction.</span>
						</div>
					)}
					{error && (
						<div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>{error}</span>
							<Button variant="outline" size="sm" onClick={handleRetryLoad} className="ml-auto">
								Retry
							</Button>
						</div>
					)}

					{/* Main Preview - Show selected thumbnail */}
					<div className="aspect-video w-full bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
						{selectedFrame ? (
							<img src={selectedFrame} alt="Selected thumbnail preview" className="w-full h-full object-contain" />
						) : existingThumbnail ? (
							<img src={existingThumbnail} alt="Current thumbnail" className="w-full h-full object-contain" />
						) : (
							<div className="text-muted-foreground flex flex-col items-center gap-2">
								<ImageIcon className="h-12 w-12" />
								<span>Select a frame below</span>
							</div>
						)}
					</div>

					{/* Hidden video element - only for duration detection */}
					{open && videoSrc && (
						<video
							ref={videoRef}
							key={`video-${file.id}`}
							className="hidden"
							src={videoSrc}
							onLoadedMetadata={handleLoadedMetadata}
							onError={handleVideoError}
							preload="metadata"
							muted
						/>
					)}

					{/* Thumbnails Strip */}
					<div className="space-y-2">
						<div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							Select a frame from the timeline
							{isGenerating && (
								<span className="text-xs text-primary flex items-center gap-1">
									<Loader2 className="h-3 w-3 animate-spin" />
									Generating frames...
								</span>
							)}
						</div>
						<ScrollArea className="w-full whitespace-nowrap rounded-md border">
							<div className="flex p-4 space-x-4">
								{frames.length === 0 && !isGenerating && showLoadingState && (
									<div className="text-sm text-muted-foreground py-4 px-2 flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading video duration...
									</div>
								)}
								{frames.length === 0 && !isGenerating && !showLoadingState && !error && videoPathForFrames && (
									<div className="text-sm text-muted-foreground py-4 px-2">Waiting for video metadata...</div>
								)}
								{frames.map((frame) => (
									<button
										key={frame.time}
										onClick={() => handleSelectFrame(frame)}
										className={`relative group shrink-0 rounded-md overflow-hidden border-2 transition-all ${
											selectedTime === frame.time
												? "border-primary ring-2 ring-primary ring-offset-2"
												: "border-transparent hover:border-muted-foreground/50"
										}`}
									>
										<div className="w-28 h-16 bg-muted relative">
											<img
												src={frame.timelineUrl}
												alt={`Frame at ${frame.time}s`}
												className="w-full h-full object-cover"
												loading="lazy"
											/>
											<div className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1">
												{new Date(frame.time * 1000).toISOString().substr(14, 5)}
											</div>
										</div>
									</button>
								))}
							</div>
							<ScrollBar orientation="horizontal" />
						</ScrollArea>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isSaving || selectedTime === null || !selectedFrame}>
						{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Set Thumbnail
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
