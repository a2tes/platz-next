"use client";

import * as React from "react";
import type { BlockComponentProps } from "../types";

export function QuoteBlock({ content, onChange }: BlockComponentProps) {
	const text = (content.text as string) || "";
	const citation = (content.citation as string) || "";

	return (
		<div className="border-l-4 border-primary/30 pl-4 space-y-2">
			<textarea
				value={text}
				onChange={(e) => onChange({ text: e.target.value })}
				placeholder="Enter quote text..."
				rows={3}
				className="w-full bg-transparent border-none outline-none resize-none text-lg italic text-foreground/80"
			/>
			<input
				type="text"
				value={citation}
				onChange={(e) => onChange({ citation: e.target.value })}
				placeholder="— Author or source"
				className="w-full bg-transparent border-none outline-none text-sm text-muted-foreground"
			/>
		</div>
	);
}
