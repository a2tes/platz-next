"use client";

import * as React from "react";
import ReactCrop, { type Crop, centerCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { IconPhoto, IconVideo, IconCrop, IconX, IconCheck } from "@tabler/icons-react";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { MediaService, type MediaFile } from "@/services/mediaService";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BlockComponentProps } from "../types";

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

export function MediaBlock({ content, onChange }: BlockComponentProps) {
	const mediaId = content.mediaId as number | null;
	const mediaType = content.mediaType as string | null;
	const caption = (content.caption as string) || "";
	const storedCrop = content.crop as { x: number; y: number; w: number; h: number } | null;

	const [cropping, setCropping] = React.useState(false);
	const [crop, setCrop] = React.useState<Crop>();
	const [aspect, setAspect] = React.useState<number | undefined>(16 / 9);
	const [imageSize, setImageSize] = React.useState({ width: 0, height: 0 });

	const { data: mediaFile } = useQuery({
		queryKey: ["media-file", mediaId],
		queryFn: () => MediaService.getFile(mediaId!),
		enabled: !!mediaId,
	});

	const createMaxCrop = (targetAspect: number, mediaWidth: number, mediaHeight: number): Crop => {
		const mediaAspect = mediaWidth / mediaHeight;
		let cropWidth: number;
		let cropHeight: number;

		if (targetAspect > mediaAspect) {
			cropWidth = 100;
			cropHeight = (mediaAspect / targetAspect) * 100;
		} else {
			cropHeight = 100;
			cropWidth = (targetAspect / mediaAspect) * 100;
		}

		return centerCrop({ unit: "%", width: cropWidth, height: cropHeight }, mediaWidth, mediaHeight);
	};

	const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const { naturalWidth, naturalHeight } = e.currentTarget;
		setImageSize({ width: naturalWidth, height: naturalHeight });
		if (aspect) {
			setCrop(createMaxCrop(aspect, naturalWidth, naturalHeight));
		}
	};

	const handleAspectChange = (newAspect: number) => {
		const newAspectValue = newAspect === 0 ? undefined : newAspect;
		setAspect(newAspectValue);
		if (newAspectValue && imageSize.width > 0 && imageSize.height > 0) {
			setCrop(createMaxCrop(newAspectValue, imageSize.width, imageSize.height));
		}
	};

	const handleCropSave = () => {
		if (crop && imageSize.width > 0 && imageSize.height > 0) {
			const scaleX = imageSize.width / 100;
			const scaleY = imageSize.height / 100;
			const pxCrop = {
				x: Math.round((crop.x ?? 0) * scaleX),
				y: Math.round((crop.y ?? 0) * scaleY),
				w: Math.round((crop.width ?? 100) * scaleX),
				h: Math.round((crop.height ?? 100) * scaleY),
			};
			onChange({ crop: pxCrop });
		}
		setCropping(false);
	};

	const handleSelectImage = () => {
		const { openSelectorModal } = useMediaLibraryStore.getState();
		openSelectorModal("image", (file: MediaFile) => {
			onChange({
				mediaId: file.id,
				mediaType: "image",
				url: file.images?.medium || file.uuid,
				originalName: file.originalName,
				alt: file.altText || "",
				crop: null,
			});
			setTimeout(() => setCropping(true), 100);
		});
	};

	const handleSelectVideo = () => {
		const { openSelectorModal } = useMediaLibraryStore.getState();
		openSelectorModal("video", (file: MediaFile) => {
			onChange({
				mediaId: file.id,
				mediaType: "video",
				url: file.uuid,
				originalName: file.originalName,
				alt: "",
				crop: null,
			});
		});
	};

	const handleRemove = () => {
		onChange({ mediaId: null, mediaType: null, url: null, originalName: null, alt: "", crop: null });
		setCropping(false);
	};

	// Build display URL with crop if available
	const displaySrc = React.useMemo(() => {
		if (!mediaFile?.uuid) return undefined;
		if (storedCrop) {
			const baseWidth = 1280;
			const outputHeight = Math.round(baseWidth / (storedCrop.w / storedCrop.h));
			return MediaService.buildImageUrl({
				uuid: mediaFile.uuid,
				crop: {
					x: Math.round(storedCrop.x),
					y: Math.round(storedCrop.y),
					w: Math.round(storedCrop.w),
					h: Math.round(storedCrop.h),
				},
				w: baseWidth,
				h: outputHeight,
				q: 82,
				format: "webp",
			});
		}
		return mediaFile.images?.medium || mediaFile.uuid;
	}, [mediaFile, storedCrop]);

	if (mediaId && mediaFile) {
		const isImage = mediaType === "image" || mediaFile.mimeType?.startsWith("image/");
		const originalSrc = mediaFile.images?.original || mediaFile.uuid;

		return (
			<div className="space-y-2">
				<div className="relative group rounded-lg overflow-hidden border bg-muted">
					{isImage ? (
						<div className="relative aspect-video">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={displaySrc}
								alt={mediaFile.altText || mediaFile.originalName}
								className="w-full h-full object-contain"
							/>
						</div>
					) : (
						<div className="relative aspect-video bg-black flex items-center justify-center">
							<IconVideo className="w-12 h-12 text-white/50" />
							<p className="absolute bottom-3 left-3 text-white text-sm">{mediaFile.originalName}</p>
						</div>
					)}
					<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
						{isImage && (
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className="h-8 w-8 p-0"
								onClick={() => setCropping(true)}
								title="Crop"
							>
								<IconCrop className="h-4 w-4" />
							</Button>
						)}
						<Button
							type="button"
							size="sm"
							variant="secondary"
							className="h-8 w-8 p-0"
							onClick={isImage ? handleSelectImage : handleSelectVideo}
						>
							{isImage ? <IconPhoto className="h-4 w-4" /> : <IconVideo className="h-4 w-4" />}
						</Button>
						<Button type="button" size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={handleRemove}>
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</div>
				<Input
					type="text"
					value={caption}
					onChange={(e) => onChange({ caption: e.target.value })}
					placeholder="Add a caption..."
					className="text-sm"
				/>

				{/* Crop Modal */}
				{cropping && isImage && (
					<Dialog open onOpenChange={(open) => !open && setCropping(false)}>
						<DialogContent className="sm:max-w-5xl p-0 overflow-hidden">
							<DialogHeader className="px-6 py-4 border-b">
								<div className="flex items-center justify-between">
									<DialogTitle>Crop Image</DialogTitle>
									<Button variant="ghost" size="icon" onClick={() => setCropping(false)} className="h-8 w-8">
										<IconX className="h-4 w-4" />
									</Button>
								</div>
							</DialogHeader>

							<div className="flex">
								{/* Crop area - Left side */}
								<div className="relative flex-1 h-[45vh] bg-black flex items-center justify-center overflow-hidden">
									<ReactCrop
										crop={crop}
										onChange={(_, percentCrop) => setCrop(percentCrop)}
										aspect={aspect}
										style={{ maxHeight: "100%", maxWidth: "100%" }}
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={originalSrc}
											alt={mediaFile.altText || mediaFile.originalName}
											onLoad={handleImageLoad}
											style={{ maxHeight: "45vh", maxWidth: "100%", display: "block" }}
										/>
									</ReactCrop>
								</div>

								{/* Aspect ratio presets - Right side */}
								<div className="w-72 border-l bg-muted/30 p-4 space-y-4 overflow-y-auto max-h-[45vh]">
									<div className="flex flex-col space-y-2">
										<span className="text-sm font-medium">Aspect Ratio</span>
										<div className="flex flex-col gap-1">
											{ASPECT_PRESETS.map((preset) => (
												<Button
													key={preset.label}
													type="button"
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

							{/* Footer */}
							<div className="px-6 py-4 border-t flex justify-end gap-2">
								<Button variant="outline" onClick={() => setCropping(false)}>
									Cancel
								</Button>
								<Button onClick={handleCropSave}>
									<IconCheck className="h-4 w-4 mr-1" />
									Apply Crop
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/30">
			<div className="flex gap-3">
				<Button type="button" variant="outline" size="sm" onClick={handleSelectImage}>
					<IconPhoto className="w-4 h-4 mr-2" />
					Add Image
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={handleSelectVideo}>
					<IconVideo className="w-4 h-4 mr-2" />
					Add Video
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">Select from media library</p>
		</div>
	);
}
