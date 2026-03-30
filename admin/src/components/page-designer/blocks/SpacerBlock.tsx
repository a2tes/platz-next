"use client";

import * as React from "react";
import { IconArrowsVertical } from "@tabler/icons-react";
import type { BlockComponentProps } from "../types";

export function SpacerBlock({ content, onChange }: BlockComponentProps) {
	const height = (content.height as number) || 48;

	return (
		<div className="flex items-center gap-3">
			<IconArrowsVertical className="w-4 h-4 text-muted-foreground shrink-0" />
			<input
				type="range"
				min={16}
				max={200}
				value={height}
				onChange={(e) => onChange({ height: parseInt(e.target.value) })}
				className="flex-1 accent-primary"
			/>
			<span className="text-xs text-muted-foreground w-12 text-right">{height}px</span>
		</div>
	);
}
