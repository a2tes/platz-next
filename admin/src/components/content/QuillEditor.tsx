"use client";

import * as React from "react";
import dynamic from "next/dynamic";

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(
	async () => {
		const { default: RQ } = await import("react-quill-new");
		return RQ;
	},
	{
		ssr: false,
		loading: () => (
			<div className="min-h-[200px] border rounded-md bg-muted/20 animate-pulse flex items-center justify-center">
				<span className="text-muted-foreground text-sm">Loading editor...</span>
			</div>
		),
	},
);

// Import Quill styles
// import "react-quill-new/dist/quill.bubble.css";
import "react-quill-new/dist/quill.snow.css";

export interface QuillEditorData {
	html: string;
	format: "quill";
}

interface QuillEditorProps {
	initialData?: QuillEditorData | string;
	onChange?: (data: QuillEditorData) => void;
	placeholder?: string;
}

// Quill toolbar configuration
const modules = {
	toolbar: [
		[{ header: [1, 2, 3, 4, 5, 6, false] }],
		["bold", "italic", "underline", "strike"],
		[{ color: [] }, { background: [] }],
		[{ align: [] }],
		[{ list: "ordered" }, { list: "bullet" }],
		["blockquote" /* "code-block" */],
		["link"],
		["clean"],
	],
	clipboard: {
		matchVisual: false,
	},
};

const formats = [
	"header",
	"bold",
	"italic",
	"underline",
	"strike",
	"color",
	"background",
	"align",
	"list",
	"blockquote",
	// "code-block",
	"link",
];

// Parse initial data - supports both Quill format and legacy EditorJS format
function parseInitialData(data?: QuillEditorData | string): string {
	if (!data) return "";

	// If it's already a QuillEditorData object
	if (typeof data === "object" && "html" in data && data.format === "quill") {
		return data.html;
	}

	// If it's a string, check if it's EditorJS JSON
	if (typeof data === "string") {
		try {
			const parsed = JSON.parse(data);
			// Check if it looks like EditorJS data
			if (parsed && typeof parsed === "object" && "blocks" in parsed && Array.isArray(parsed.blocks)) {
				return convertEditorJSToHTML(parsed);
			}
		} catch {
			// Not JSON, might be plain HTML or text
			// Check if it looks like HTML
			if (data.includes("<") && data.includes(">")) {
				return data;
			}
			// Plain text - wrap in paragraph
			return data ? `<p>${data}</p>` : "";
		}
	}

	return "";
}

// Convert EditorJS blocks to HTML (for migration from EditorJS)
function convertEditorJSToHTML(editorData: { blocks: Array<{ type: string; data: any; tunes?: any }> }): string {
	if (!editorData?.blocks) return "";

	return editorData.blocks
		.map((block) => {
			const alignment = block.tunes?.alignment?.alignment;
			const alignStyle = alignment && alignment !== "left" ? ` style="text-align: ${alignment}"` : "";

			switch (block.type) {
				case "paragraph":
					return `<p${alignStyle}>${block.data.text || ""}</p>`;

				case "header":
					const level = block.data.level || 2;
					return `<h${level}${alignStyle}>${block.data.text || ""}</h${level}>`;

				case "list":
					const tag = block.data.style === "ordered" ? "ol" : "ul";
					const items = (block.data.items || []).map((item: string) => `<li>${item}</li>`).join("");
					return `<${tag}${alignStyle}>${items}</${tag}>`;

				case "quote":
					return `<blockquote${alignStyle}>${block.data.text || ""}</blockquote>`;

				case "delimiter":
					return "<hr />";

				case "code":
					return `<pre><code>${block.data.code || ""}</code></pre>`;

				default:
					return "";
			}
		})
		.filter(Boolean)
		.join("\n");
}

export function QuillEditor({ initialData, onChange, placeholder = "Start writing..." }: QuillEditorProps) {
	const [value, setValue] = React.useState(() => parseInitialData(initialData));
	const [mounted, setMounted] = React.useState(false);
	const initialDataLoadedRef = React.useRef(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	// Sync value when initialData changes (e.g., after async data fetch)
	React.useEffect(() => {
		if (initialData && !initialDataLoadedRef.current) {
			const parsedData = parseInitialData(initialData);
			if (parsedData) {
				setValue(parsedData);
				initialDataLoadedRef.current = true;
			}
		}
	}, [initialData]);

	const handleChange = React.useCallback(
		(content: string) => {
			setValue(content);
			onChange?.({
				html: content,
				format: "quill",
			});
		},
		[onChange],
	);

	if (!mounted) {
		return (
			<div className="min-h-[200px] border rounded-md bg-muted/20 animate-pulse flex items-center justify-center">
				<span className="text-muted-foreground text-sm">Loading editor...</span>
			</div>
		);
	}

	return (
		<div className="quill-editor-wrapper">
			<ReactQuill
				// theme="bubble"
				theme="snow"
				value={value}
				onChange={handleChange}
				modules={modules}
				formats={formats}
				placeholder={placeholder}
			/>
			<style jsx global>{`
				.quill-editor-wrapper .ql-container {
					min-height: 200px;
					max-height: 450px;
					overflow-y: auto;
					font-size: 1.125rem;
					line-height: 1.75;
					background: transparent;
				}
				.quill-editor-wrapper .ql-toolbar {
					border-radius: 8px 8px 0 0;
					border-color: var(--border);
				}
				.quill-editor-wrapper .ql-container {
					border-radius: 0 0 8px 8px;
					border-color: var(--border);
				}
				.quill-editor-wrapper .ql-editor h1 {
					font-size: 3rem;
					font-weight: 400;
					line-height: 1.2;
					margin: 0 0 0.5em 0;
				}
				.quill-editor-wrapper .ql-editor h2 {
					font-size: 2.25rem;
					font-weight: 400;
					line-height: 1.2;
					margin: 0 0 0.5em 0;
				}
				.quill-editor-wrapper .ql-editor h3 {
					font-size: 1.875rem;
					font-weight: 400;
					line-height: 1.3;
					margin: 0 0 0.5em 0;
				}
				.quill-editor-wrapper .ql-editor h4 {
					font-size: 1.5rem;
					font-weight: 400;
					line-height: 1.4;
					margin: 0 0 0.5em 0;
				}
				.quill-editor-wrapper .ql-editor h5 {
					font-size: 1.25rem;
					font-weight: 400;
					line-height: 1.5;
					margin: 0 0 0.5em 0;
				}
				.quill-editor-wrapper .ql-editor h6 {
					font-size: 1.125rem;
					font-weight: 400;
					line-height: 1.5;
					margin: 0 0 0.5em 0;
				}
				.quill-editor-wrapper .ql-editor p {
					font-size: 1.125rem;
					margin: 0 0 1em 0;
				}
				.quill-editor-wrapper .ql-editor blockquote {
					border-left: 4px solid #d1d5db;
					padding-left: 1rem;
					font-style: italic;
					color: #6b7280;
				}
			`}</style>
		</div>
	);
}
