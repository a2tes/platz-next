"use client";

import * as React from "react";
import { IconExternalLink } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import type { BlockComponentProps } from "../types";

function getEmbedUrl(url: string): string | null {
	try {
		const parsed = new URL(url);

		// YouTube
		if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
			let videoId: string | null = null;
			if (parsed.hostname.includes("youtu.be")) {
				videoId = parsed.pathname.slice(1);
			} else {
				videoId = parsed.searchParams.get("v");
			}
			if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
		}

		// Vimeo
		if (parsed.hostname.includes("vimeo.com")) {
			const match = parsed.pathname.match(/\/(\d+)/);
			if (match) return `https://player.vimeo.com/video/${encodeURIComponent(match[1])}`;
		}

		return null;
	} catch {
		return null;
	}
}

export function EmbedBlock({ content, onChange }: BlockComponentProps) {
	const url = (content.url as string) || "";
	const caption = (content.caption as string) || "";
	const embedUrl = url ? getEmbedUrl(url) : null;

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<IconExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
				<Input
					type="url"
					value={url}
					onChange={(e) => onChange({ url: e.target.value })}
					placeholder="Paste YouTube or Vimeo URL..."
					className="text-sm"
				/>
			</div>

			{embedUrl && (
				<div className="aspect-video rounded-lg overflow-hidden border bg-black">
					<iframe
						src={embedUrl}
						className="w-full h-full"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						title="Embedded content"
					/>
				</div>
			)}

			{url && !embedUrl && <p className="text-xs text-muted-foreground">Unsupported URL. Supported: YouTube, Vimeo</p>}

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
