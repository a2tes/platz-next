"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { BlockComponentProps } from "../types";

const ReactQuill = dynamic(
	async () => {
		const { default: RQ } = await import("react-quill-new");
		return RQ;
	},
	{
		ssr: false,
		loading: () => (
			<div className="min-h-25 border rounded-md bg-muted/20 animate-pulse flex items-center justify-center">
				<span className="text-muted-foreground text-sm">Loading editor...</span>
			</div>
		),
	},
);

import "react-quill-new/dist/quill.snow.css";

const modules = {
	toolbar: [
		["bold", "italic", "underline", "strike"],
		[{ color: [] }, { background: [] }],
		[{ align: [] }],
		[{ list: "ordered" }, { list: "bullet" }],
		["blockquote"],
		["link"],
		["clean"],
	],
	clipboard: {
		matchVisual: false,
	},
};

const formats = ["bold", "italic", "underline", "strike", "color", "background", "align", "list", "blockquote", "link"];

export function ParagraphBlock({ content, onChange }: BlockComponentProps) {
	const [value, setValue] = React.useState(() => (content.html as string) || "");
	const [mounted, setMounted] = React.useState(false);
	const initializedRef = React.useRef(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	React.useEffect(() => {
		if (content.html && !initializedRef.current) {
			const html = content.html as string;
			if (html) {
				setValue(html);
				initializedRef.current = true;
			}
		}
	}, [content.html]);

	const handleChange = React.useCallback(
		(html: string) => {
			setValue(html);
			onChange({ html });
		},
		[onChange],
	);

	if (!mounted) {
		return (
			<div className="min-h-25 border rounded-md bg-muted/20 animate-pulse flex items-center justify-center">
				<span className="text-muted-foreground text-sm">Loading editor...</span>
			</div>
		);
	}

	return (
		<div className="page-designer-paragraph">
			<ReactQuill
				theme="snow"
				value={value}
				onChange={handleChange}
				modules={modules}
				formats={formats}
				placeholder="Start typing..."
			/>
			<style jsx global>{`
				.page-designer-paragraph .ql-container {
					min-height: 6.25rem;
					max-height: 18.75rem;
					overflow-y: auto;
					font-size: 1rem;
					line-height: 1.75;
					background: transparent;
				}
				.page-designer-paragraph .ql-toolbar {
					border-radius: 8px 8px 0 0;
					border-color: var(--border);
				}
				.page-designer-paragraph .ql-container {
					border-radius: 0 0 8px 8px;
					border-color: var(--border);
				}
				.page-designer-paragraph .ql-editor {
					font-size: 1rem;
				}
				.page-designer-paragraph .ql-editor p {
					margin: 0 0 0.75em 0;
				}
				.page-designer-paragraph .ql-editor blockquote {
					border-left: 4px solid #d1d5db;
					padding-left: 1rem;
					font-style: italic;
					color: #6b7280;
				}
			`}</style>
		</div>
	);
}
