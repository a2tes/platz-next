"use client";

import * as React from "react";
import type { BlockComponentProps } from "../types";

const LEVELS = [
	{ value: 1, label: "H1", className: "text-4xl font-bold" },
	{ value: 2, label: "H2", className: "text-3xl font-bold" },
	{ value: 3, label: "H3", className: "text-2xl font-semibold" },
	{ value: 4, label: "H4", className: "text-xl font-semibold" },
];

export function HeadingBlock({ content, onChange }: BlockComponentProps) {
	const level = (content.level as number) || 2;
	const text = (content.text as string) || "";
	const config = LEVELS.find((l) => l.value === level) || LEVELS[1];

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-1">
				{LEVELS.map((l) => (
					<button
						key={l.value}
						type="button"
						onClick={() => onChange({ level: l.value })}
						className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
							level === l.value
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:bg-accent"
						}`}
					>
						{l.label}
					</button>
				))}
			</div>
			<input
				type="text"
				value={text}
				onChange={(e) => onChange({ text: e.target.value })}
				placeholder="Enter heading text..."
				className={`w-full bg-transparent border-none outline-none ${config.className}`}
			/>
		</div>
	);
}
