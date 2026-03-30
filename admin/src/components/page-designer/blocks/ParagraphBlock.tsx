"use client";

import * as React from "react";
import type { BlockComponentProps } from "../types";

export function ParagraphBlock({ content, onChange }: BlockComponentProps) {
	const editorRef = React.useRef<HTMLDivElement>(null);
	const initializedRef = React.useRef(false);

	React.useEffect(() => {
		if (editorRef.current && !initializedRef.current) {
			editorRef.current.innerHTML = (content.html as string) || "";
			initializedRef.current = true;
		}
	}, [content.html]);

	const handleInput = () => {
		if (editorRef.current) {
			onChange({ html: editorRef.current.innerHTML });
		}
	};

	const execCommand = (command: string, value?: string) => {
		document.execCommand(command, false, value);
		editorRef.current?.focus();
		handleInput();
	};

	const handleLink = () => {
		const url = window.prompt("Enter URL:");
		if (url) {
			execCommand("createLink", url);
		}
	};

	return (
		<div className="group/rt relative">
			{/* Floating toolbar */}
			<div className="mb-2 flex gap-1 opacity-0 group-focus-within/rt:opacity-100 transition-opacity">
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						execCommand("bold");
					}}
					className="px-2 py-1 hover:bg-accent rounded text-xs font-bold border"
				>
					B
				</button>
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						execCommand("italic");
					}}
					className="px-2 py-1 hover:bg-accent rounded text-xs italic border"
				>
					I
				</button>
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						execCommand("underline");
					}}
					className="px-2 py-1 hover:bg-accent rounded text-xs underline border"
				>
					U
				</button>
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						execCommand("strikeThrough");
					}}
					className="px-2 py-1 hover:bg-accent rounded text-xs line-through border"
				>
					S
				</button>
				<div className="w-px bg-border mx-1" />
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						handleLink();
					}}
					className="px-2 py-1 hover:bg-accent rounded text-xs border"
				>
					Link
				</button>
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						execCommand("insertUnorderedList");
					}}
					className="px-2 py-1 hover:bg-accent rounded text-xs border"
				>
					• List
				</button>
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						execCommand("insertOrderedList");
					}}
					className="px-2 py-1 hover:bg-accent rounded text-xs border"
				>
					1. List
				</button>
			</div>

			{/* Editor */}
			<div
				ref={editorRef}
				contentEditable
				onInput={handleInput}
				suppressContentEditableWarning
				data-placeholder="Start typing..."
				className="min-h-20 outline-none text-base leading-relaxed prose prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
			/>
		</div>
	);
}
