"use client";

import * as React from "react";
import { IconPhoto, IconVideo, IconX } from "@tabler/icons-react";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { MediaService } from "@/services/mediaService";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import type { BlockComponentProps } from "../types";

export function MediaBlock({ content, onChange }: BlockComponentProps) {
	const mediaId = content.mediaId as number | null;
	const mediaType = content.mediaType as string | null;
	const caption = (content.caption as string) || "";

	const { data: mediaFile } = useQuery({
		queryKey: ["media-file", mediaId],
		queryFn: () => MediaService.getFile(mediaId!),
		enabled: !!mediaId,
	});

	const handleSelectMedia = (type: "image" | "video") => {
		const { openSelectorModal } = useMediaLibraryStore.getState();
		openSelectorModal(type === "image" ? "image" : "video", (file) => {
			const isImage = file.mimeType.startsWith("image/");
			onChange({
				mediaId: file.id,
				mediaType: isImage ? "image" : "video",
				url: file.images?.medium || file.uuid,
				originalName: file.originalName,
				alt: file.altText || "",
			});
		});
	};

	const handleRemove = () => {
		onChange({ mediaId: null, mediaType: null, url: null, originalName: null, alt: "" });
	};

	if (mediaId && mediaFile) {
		const isImage = mediaType === "image" || mediaFile.mimeType?.startsWith("image/");
		return (
			<div className="space-y-2">
				<div className="relative group rounded-lg overflow-hidden border bg-muted">
					{isImage ? (
						<div className="relative aspect-video">
							<Image
								src={mediaFile.images?.medium || mediaFile.uuid}
								alt={mediaFile.altText || mediaFile.originalName}
								fill
								className="object-contain"
								unoptimized
							/>
						</div>
					) : (
						<div className="relative aspect-video bg-black flex items-center justify-center">
							<IconVideo className="w-12 h-12 text-white/50" />
							<p className="absolute bottom-3 left-3 text-white text-sm">{mediaFile.originalName}</p>
						</div>
					)}
					<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
						<Button
							type="button"
							size="sm"
							variant="secondary"
							className="h-8 w-8 p-0"
							onClick={() => handleSelectMedia(isImage ? "image" : "video")}
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
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/30">
			<div className="flex gap-3">
				<Button type="button" variant="outline" size="sm" onClick={() => handleSelectMedia("image")}>
					<IconPhoto className="w-4 h-4 mr-2" />
					Add Image
				</Button>
				<Button type="button" variant="outline" size="sm" onClick={() => handleSelectMedia("video")}>
					<IconVideo className="w-4 h-4 mr-2" />
					Add Video
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">Select from media library</p>
		</div>
	);
}
