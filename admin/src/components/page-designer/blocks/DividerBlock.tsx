"use client";

import * as React from "react";
import type { BlockComponentProps } from "../types";

const STYLES = [
	{ value: "solid", label: "Solid" },
	{ value: "dashed", label: "Dashed" },
	{ value: "dotted", label: "Dotted" },
];

export function DividerBlock({ content, onChange }: BlockComponentProps) {
	const style = (content.style as string) || "solid";

	return (
		<div className="space-y-2">
			<hr className="border-t border-border" style={{ borderStyle: style }} />
			<div className="flex gap-1">
				{STYLES.map((s) => (
					<button
						key={s.value}
						type="button"
						onClick={() => onChange({ style: s.value })}
						className={`px-2 py-0.5 text-xs rounded transition-colors ${
							style === s.value
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:bg-accent"
						}`}
					>
						{s.label}
					</button>
				))}
			</div>
		</div>
	);
}
