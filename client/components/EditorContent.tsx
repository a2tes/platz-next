"use client";

import React from "react";
import Image from "next/image";
import { TextGenerateSequence } from "@/components/ui/shadcn-io/text-generate-sequence";

// Linklere target="_blank" ve rel="noopener noreferrer" ekler
function processLinks(html: string): string {
	return html.replace(/<a\s+([^>]*?)href=/gi, '<a $1target="_blank" rel="noopener noreferrer" href=');
}

// Quill format check
interface QuillData {
	html: string;
	format: "quill";
}

function isQuillData(data: unknown): data is QuillData {
	return (
		typeof data === "object" &&
		data !== null &&
		"format" in data &&
		(data as QuillData).format === "quill" &&
		"html" in data
	);
}

interface EditorBlock {
	type: string;
	data: any;
	tunes?: {
		alignment?: {
			alignment: "left" | "center" | "right" | "justify";
		};
	};
}

interface EditorData {
	blocks: EditorBlock[];
}

interface EditorContentProps {
	data: EditorData | QuillData;
	animated?: boolean;
}

export default function EditorContent({ data, animated = false }: EditorContentProps) {
	// Handle Quill format (HTML string)
	if (isQuillData(data)) {
		// Replace &nbsp; with regular spaces to allow proper word wrapping
		const processedHtml = processLinks(data.html.replace(/&nbsp;/g, " "));
		return (
			<>
				<style jsx global>{`
					/* Quill alignment classes */
					.editor-content .ql-align-center {
						text-align: center;
					}
					.editor-content .ql-align-right {
						text-align: right;
					}
					.editor-content .ql-align-justify {
						text-align: justify;
					}
					/* Quill indent classes */
					.editor-content .ql-indent-1 {
						padding-left: 3em;
					}
					.editor-content .ql-indent-2 {
						padding-left: 6em;
					}
					.editor-content .ql-indent-3 {
						padding-left: 9em;
					}
					/* Prevent overflow */
					.editor-content {
						word-wrap: break-word;
						overflow-wrap: break-word;
						word-break: break-word;
						max-width: 100%;
						overflow-x: hidden;
					}
					.editor-content * {
						max-width: 100%;
					}
				`}</style>
				<article
					className="editor-content prose prose-lg max-w-none prose-invert space-y-2"
					dangerouslySetInnerHTML={{ __html: processedHtml }}
				/>
			</>
		);
	}

	// Handle EditorJS format (blocks)
	if (!data?.blocks) return null;

	// Animated mode: sadece paragrafları TextGenerateSequence ile göster
	if (animated) {
		const paragraphItems = data.blocks
			.filter((block) => block.type === "paragraph")
			.map((block) => ({
				text: block.data.text.replace(/&nbsp;/g, " "),
				style: { textAlign: getAlignmentStyle(block) } as React.CSSProperties,
			}));

		const otherBlocks = data.blocks.filter((block) => block.type !== "paragraph");

		return (
			<article className="prose prose-lg max-w-none prose-invert space-y-2">
				<TextGenerateSequence texts={paragraphItems} />
				{otherBlocks.map((block: EditorBlock, index: number) => renderBlock(block, index))}
			</article>
		);
	}

	return (
		<article className="editor-content prose prose-lg max-w-none prose-invert space-y-2">
			{data.blocks.map((block: EditorBlock, index: number) => renderBlock(block, index))}
		</article>
	);
}

function getAlignmentStyle(block: EditorBlock): "left" | "center" | "right" | "justify" {
	return block.tunes?.alignment?.alignment || "left";
}

function renderBlock(block: EditorBlock, index: number) {
	const alignStyle = getAlignmentStyle(block);

	switch (block.type) {
		case "paragraph":
			return (
				<p
					key={index}
					className="text-lg"
					style={{ textAlign: alignStyle }}
					dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }}
				/>
			);

		case "header":
			const level = block.data.level || 2;
			const getHeaderFontSize = (level: number): React.CSSProperties => {
				const sizes: { [key: number]: string } = {
					1: "clamp(2rem, 8vw, 3rem)",
					2: "clamp(1.75rem, 7vw, 2.5rem)",
					3: "clamp(1.5rem, 6vw, 2rem)",
					4: "clamp(1.25rem, 5vw, 1.75rem)",
					5: "clamp(1.125rem, 4vw, 1.5rem)",
					6: "clamp(1rem, 3vw, 1.25rem)",
				};
				return {
					fontSize: sizes[level] || sizes[2],
					textAlign: alignStyle,
				};
			};

			if (level === 1) {
				return (
					<h1
						key={index}
						style={getHeaderFontSize(level)}
						dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }}
					/>
				);
			} else if (level === 2) {
				return (
					<h2
						key={index}
						style={getHeaderFontSize(level)}
						dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }}
					/>
				);
			} else if (level === 3) {
				return (
					<h3
						key={index}
						style={getHeaderFontSize(level)}
						dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }}
					/>
				);
			} else if (level === 4) {
				return (
					<h4
						key={index}
						style={getHeaderFontSize(level)}
						dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }}
					/>
				);
			} else if (level === 5) {
				return (
					<h5
						key={index}
						style={getHeaderFontSize(level)}
						dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }}
					/>
				);
			} else {
				return (
					<h6
						key={index}
						style={getHeaderFontSize(level)}
						dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }}
					/>
				);
			}
		case "image":
			return (
				<figure key={index} className="my-8">
					<Image
						src={block.data.file?.url || block.data.url}
						alt={block.data.caption || ""}
						width={800}
						height={600}
						className="rounded-lg"
					/>
					{block.data.caption && (
						<figcaption className="text-center text-sm text-gray-400 mt-2">{block.data.caption}</figcaption>
					)}
				</figure>
			);

		case "list":
			const ListTag = block.data.style === "ordered" ? "ol" : "ul";
			return (
				<ListTag key={index} style={{ textAlign: alignStyle }}>
					{block.data.items.map((item: string, i: number) => (
						<li key={i} dangerouslySetInnerHTML={{ __html: processLinks(item) }} />
					))}
				</ListTag>
			);

		case "quote":
			return (
				<blockquote key={index} style={{ textAlign: alignStyle }}>
					<p dangerouslySetInnerHTML={{ __html: processLinks(block.data.text) }} />
					{block.data.caption && <cite className="text-sm text-gray-400">— {block.data.caption}</cite>}
				</blockquote>
			);

		case "delimiter":
			return <hr key={index} className="my-8" />;

		case "embed":
			return (
				<div key={index} className="my-8">
					<iframe
						src={block.data.embed}
						width={block.data.width || "100%"}
						height={block.data.height || 400}
						className="rounded-lg"
						allowFullScreen
					/>
					{block.data.caption && <p className="text-center text-sm text-gray-400 mt-2">{block.data.caption}</p>}
				</div>
			);

		case "table":
			const hasHeader = block.data.withHeadings;
			const content = block.data.content || [];
			return (
				<div key={index} className="my-8 overflow-x-auto">
					<table className="w-full border-collapse">
						{hasHeader && content.length > 0 && (
							<thead>
								<tr>
									{content[0].map((cell: string, cellIndex: number) => (
										<th
											key={cellIndex}
											className="border border-gray-200 bg-gray-100 px-4 py-2 text-left font-semibold"
											dangerouslySetInnerHTML={{ __html: processLinks(cell) }}
										/>
									))}
								</tr>
							</thead>
						)}
						<tbody>
							{content.slice(hasHeader ? 1 : 0).map((row: string[], rowIndex: number) => (
								<tr key={rowIndex}>
									{row.map((cell: string, cellIndex: number) => (
										<td
											key={cellIndex}
											className="border border-gray-200 px-4 py-2"
											dangerouslySetInnerHTML={{ __html: processLinks(cell) }}
										/>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);

		case "code":
			return (
				<pre key={index} className="my-4 p-4 bg-gray-200 rounded-lg overflow-x-auto">
					<code className="text-sm text-gray-800 font-mono">{block.data.code}</code>
				</pre>
			);

		default:
			return null;
	}
}
