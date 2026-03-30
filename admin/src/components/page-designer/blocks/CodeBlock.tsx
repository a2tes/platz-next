"use client";

import * as React from "react";
import type { BlockComponentProps } from "../types";

const LANGUAGES = [
	"javascript",
	"typescript",
	"html",
	"css",
	"python",
	"json",
	"bash",
	"sql",
	"go",
	"rust",
	"java",
	"php",
	"ruby",
	"yaml",
	"markdown",
	"plaintext",
];

export function CodeBlock({ content, onChange }: BlockComponentProps) {
	const code = (content.code as string) || "";
	const language = (content.language as string) || "javascript";

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<select
					value={language}
					onChange={(e) => onChange({ language: e.target.value })}
					className="text-xs bg-muted border rounded px-2 py-1 outline-none"
				>
					{LANGUAGES.map((lang) => (
						<option key={lang} value={lang}>
							{lang}
						</option>
					))}
				</select>
			</div>
			<textarea
				value={code}
				onChange={(e) => onChange({ code: e.target.value })}
				placeholder="Enter code..."
				rows={8}
				spellCheck={false}
				className="w-full bg-zinc-950 text-zinc-100 font-mono text-sm p-4 rounded-lg border border-zinc-800 outline-none resize-y leading-relaxed"
			/>
		</div>
	);
}
