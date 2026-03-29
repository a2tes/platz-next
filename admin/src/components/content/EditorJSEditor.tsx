"use client";

import * as React from "react";
import type { OutputData } from "@editorjs/editorjs";

interface EditorJSEditorProps {
	initialData?: OutputData;
	onChange?: (data: OutputData) => void;
}

export function EditorJSEditor({ initialData, onChange }: EditorJSEditorProps) {
	const [uid] = React.useState(() => Math.random().toString(36).slice(2));
	const holderId = React.useMemo(() => `ej_${uid}`, [uid]);
	const holderRef = React.useRef<HTMLDivElement | null>(null);

	type EditorInstance = {
		destroy: () => void;
		save: () => Promise<OutputData>;
		render?: (data: OutputData) => Promise<void> | void;
	};

	const editorRef = React.useRef<EditorInstance | null>(null);
	const pendingDataRef = React.useRef<OutputData | undefined>(initialData);
	const lastRenderedHashRef = React.useRef<string | null>(null);
	const isRenderingRef = React.useRef<boolean>(false);

	// Coalesce render calls: avoid concurrent renders and duplicate renders with the same data
	const enqueueRenderFromPending = React.useCallback(async () => {
		const editor = editorRef.current as unknown as {
			isReady?: Promise<unknown>;
			render?: (data: OutputData) => Promise<void> | void;
		} | null;
		if (!editor) return;
		if (isRenderingRef.current) return;

		const data = pendingDataRef.current;
		if (!data) return;
		const hash = JSON.stringify(data);
		if (lastRenderedHashRef.current === hash) {
			pendingDataRef.current = undefined;
			return;
		}

		isRenderingRef.current = true;
		try {
			await editor.isReady?.catch(() => undefined);
			const cloned =
				typeof structuredClone === "function"
					? structuredClone(data)
					: (JSON.parse(JSON.stringify(data)) as OutputData);
			await editor.render?.(cloned);
			lastRenderedHashRef.current = hash;
			pendingDataRef.current = undefined;
		} finally {
			isRenderingRef.current = false;
			// If new data arrived while rendering, try again
			const again = pendingDataRef.current;
			if (again && JSON.stringify(again) !== lastRenderedHashRef.current) {
				void enqueueRenderFromPending();
			}
		}
	}, []);

	React.useEffect(() => {
		let cancelled = false;
		(async () => {
			if (typeof window === "undefined") return;
			if (editorRef.current) return;

			// Ensure the holder exists in DOM
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve())
			);
			if (!holderRef.current) return;

			const [
				{ default: EditorJS },
				{ default: Header },
				{ default: List },
				{ default: Delimiter },
				{ default: Code },
				{ default: InlineCode },
				{ default: Marker },
				{ default: Table },
				{ default: Quote },
				{ default: AlignmentTuneTool },
			] = await Promise.all([
				import("@editorjs/editorjs"),
				import("@editorjs/header"),
				import("@editorjs/list"),
				import("@editorjs/delimiter"),
				import("@editorjs/code"),
				import("@editorjs/inline-code"),
				import("@editorjs/marker"),
				import("@editorjs/table"),
				import("@editorjs/quote"),
				import("editorjs-text-alignment-blocktune"),
			]);

			if (cancelled) return;

			const instance = new EditorJS({
				holder: holderRef.current!,
				// Start empty; we'll render via onReady/effect to avoid double-clear
				data: undefined,
				autofocus: false,
				onReady: async () => {
					await enqueueRenderFromPending();
				},
				tools: {
					alignment: {
						class: AlignmentTuneTool,
						config: {
							default: "left",
							blocks: {
								header: "left",
								paragraph: "left",
								list: "left",
								quote: "left",
							},
						},
					},
					header: {
						class: Header,
						inlineToolbar: ["bold", "italic"],
						config: { levels: [1, 2, 3, 4, 5, 6], defaultLevel: 1 },
						tunes: ["alignment"],
					},
					list: { class: List, inlineToolbar: true, tunes: ["alignment"] },
					delimiter: Delimiter,
					code: Code,
					inlineCode: InlineCode,
					marker: Marker,
					table: Table,
					quote: { class: Quote, inlineToolbar: true, tunes: ["alignment"] },
					paragraph: {
						tunes: ["alignment"],
					},
				},
				onChange: async () => {
					if (!onChange) return;
					const data = await instance.save();
					onChange(data);
				},
			});

			editorRef.current = instance;
		})();

		return () => {
			cancelled = true;
			const inst = editorRef.current as unknown as {
				destroy?: (() => void) | undefined;
				destroyEditor?: (() => void) | undefined;
			};
			try {
				if (inst && typeof inst.destroy === "function") {
					inst.destroy();
				} else if (inst && typeof inst.destroyEditor === "function") {
					inst.destroyEditor();
				}
			} catch {
				// ignore
			} finally {
				editorRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [holderId, onChange]);

	React.useEffect(() => {
		pendingDataRef.current = initialData;
		if (!initialData) return;
		void enqueueRenderFromPending();
	}, [initialData, enqueueRenderFromPending]);

	return (
		<div className="border rounded-md">
			<style
				dangerouslySetInnerHTML={{
					__html: `#${holderId} .codex-editor__redactor{padding-bottom:30px!important;}`,
				}}
			/>
			<div id={holderId} ref={holderRef} className="min-h-[240px] px-2 py-3" />
		</div>
	);
}
