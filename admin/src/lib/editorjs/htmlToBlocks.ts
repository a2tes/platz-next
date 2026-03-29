"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { OutputBlockData, OutputData } from "@editorjs/editorjs";

/**
 * Very lightweight HTML -> Editor.js blocks converter to rehydrate the editor.
 * Supports: h2/h3/h4 (header), p (paragraph), ul/ol (list), hr (delimiter),
 * pre/code (code), blockquote (quote), table (table). Inline formats are ignored.
 */
export function htmlToEditorJsOutput(
	html: string | null | undefined
): OutputData | undefined {
	if (!html) return undefined;
	const trimmed = html.trim();
	if (!trimmed) return { time: Date.now(), blocks: [], version: "2.30.7" };

	// Parse HTML safely in the browser
	const container = document.createElement("div");
	container.innerHTML = trimmed;

	const blocks: OutputBlockData[] = [];

	const getTextAlign = (
		el: Element | null
	): "left" | "right" | "center" | "justify" | undefined => {
		if (!el) return undefined;
		const style = (el.getAttribute("style") || "").toLowerCase();
		const m = /text-align\s*:\s*(left|right|center|justify)/.exec(style);
		return (m?.[1] as any) || undefined;
	};

	const pushParagraphIfText = (node: ChildNode) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = (node.textContent || "").trim();
			if (text) {
				blocks.push({ type: "paragraph", data: { text } as any });
			}
		}
	};

	const processElement = (el: Element): OutputBlockData | null => {
		const tag = el.tagName.toUpperCase();
		// Unwrap alignment wrapper: <div style="text-align:..."> <BLOCK /> </div>
		if (tag === "DIV" && !!getTextAlign(el) && el.children.length === 1) {
			const align = getTextAlign(el);
			const inner = el.children[0] as Element;
			const block = processElement(inner);
			if (block && align && align !== "left") {
				// Attach alignment tune
				return {
					...(block as any),
					tunes: { ...(block as any).tunes, alignment: { alignment: align } },
				} as any;
			}
			return block;
		}
		switch (tag) {
			case "H2":
			case "H3":
			case "H4": {
				const level = Number(tag.substring(1));
				const text = el.textContent || "";
				return { type: "header", data: { text, level } as any } as any;
			}
			case "P": {
				const text = el.innerHTML || ""; // allow inline markup inside paragraph
				if (text && text.replace(/<br\s*\/?>(\s|&nbsp;)*$/i, "").trim()) {
					return { type: "paragraph", data: { text } as any } as any;
				}
				return null;
			}
			case "UL":
			case "OL": {
				const items = Array.from(el.querySelectorAll(":scope > li")).map(
					(li) => li.innerHTML || ""
				);
				const style = tag === "OL" ? "ordered" : "unordered";
				return { type: "list", data: { style, items } as any } as any;
			}
			case "HR": {
				return { type: "delimiter", data: {} as any } as any;
			}
			case "PRE": {
				const codeEl = el.querySelector("code");
				const code = (codeEl ? codeEl.textContent : el.textContent) || "";
				return { type: "code", data: { code } as any } as any;
			}
			case "CODE": {
				// Standalone code (without pre)
				const code = el.textContent || "";
				return { type: "code", data: { code } as any } as any;
			}
			case "BLOCKQUOTE": {
				const text = el.innerHTML || "";
				return {
					type: "quote",
					data: { text, caption: "", alignment: "left" } as any,
				} as any;
			}
			case "TABLE": {
				const rows = Array.from(
					el.querySelectorAll(":scope > tbody > tr, :scope > tr")
				);
				const content = rows.map((tr) =>
					Array.from(tr.querySelectorAll("th, td")).map(
						(td) => td.innerHTML || ""
					)
				);
				return {
					type: "table",
					data: { withHeadings: false, content } as any,
				} as any;
			}
			default: {
				// Fallback: if an element contains text-only, treat as paragraph
				const text = el.textContent?.trim();
				if (text) {
					return {
						type: "paragraph",
						data: { text: el.innerHTML } as any,
					} as any;
				}
				return null;
			}
		}
	};

	Array.from(container.childNodes).forEach((node) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const block = processElement(node as Element);
			if (block) blocks.push(block);
		} else {
			pushParagraphIfText(node);
		}
	});

	return { time: Date.now(), blocks, version: "2.30.7" };
}
