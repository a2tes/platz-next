"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	IconGripVertical,
	IconTrash,
	IconCopy,
	IconH1,
	IconAlignLeft,
	IconQuote,
	IconPhoto,
	IconSpacingVertical,
	IconMinus,
	IconBrandYoutube,
	IconCode,
	IconSquareNumber1,
	IconSquareNumber2,
	IconSquareNumber3,
	IconSquareNumber4,
	IconLayoutSidebar,
	IconLayoutSidebarRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
	HeadingBlock,
	ParagraphBlock,
	QuoteBlock,
	MediaBlock,
	SpacerBlock,
	DividerBlock,
	EmbedBlock,
	CodeBlock,
	ColumnBlock,
} from "./blocks";
import type {
	DesignerBlock,
	DesignerBlockType,
	DesignerElementBlockType,
	DesignerLayoutBlockType,
	BlockComponentProps,
} from "./types";
import { isLayoutBlockType } from "./types";

const BLOCK_ICONS: Record<DesignerBlockType, React.ReactNode> = {
	HEADING: <IconH1 className="w-3.5 h-3.5" />,
	PARAGRAPH: <IconAlignLeft className="w-3.5 h-3.5" />,
	QUOTE: <IconQuote className="w-3.5 h-3.5" />,
	MEDIA: <IconPhoto className="w-3.5 h-3.5" />,
	SPACER: <IconSpacingVertical className="w-3.5 h-3.5" />,
	DIVIDER: <IconMinus className="w-3.5 h-3.5" />,
	EMBED: <IconBrandYoutube className="w-3.5 h-3.5" />,
	CODE_BLOCK: <IconCode className="w-3.5 h-3.5" />,
	ONE_COLUMN: <IconSquareNumber1 className="w-3.5 h-3.5" />,
	TWO_COLUMN: <IconSquareNumber2 className="w-3.5 h-3.5" />,
	THREE_COLUMN: <IconSquareNumber3 className="w-3.5 h-3.5" />,
	FOUR_COLUMN: <IconSquareNumber4 className="w-3.5 h-3.5" />,
	ONE_TWO: <IconLayoutSidebar className="w-3.5 h-3.5" />,
	TWO_ONE: <IconLayoutSidebarRight className="w-3.5 h-3.5" />,
};

const BLOCK_LABELS: Record<DesignerBlockType, string> = {
	HEADING: "Heading",
	PARAGRAPH: "Paragraph",
	QUOTE: "Quote",
	MEDIA: "Media",
	SPACER: "Spacer",
	DIVIDER: "Divider",
	EMBED: "Embed",
	CODE_BLOCK: "Code",
	ONE_COLUMN: "1 Column",
	TWO_COLUMN: "2 Columns",
	THREE_COLUMN: "3 Columns",
	FOUR_COLUMN: "4 Columns",
	ONE_TWO: "1:2 Split",
	TWO_ONE: "2:1 Split",
};

const ELEMENT_COMPONENTS: Record<DesignerElementBlockType, React.FC<BlockComponentProps>> = {
	HEADING: HeadingBlock,
	PARAGRAPH: ParagraphBlock,
	QUOTE: QuoteBlock,
	MEDIA: MediaBlock,
	SPACER: SpacerBlock,
	DIVIDER: DividerBlock,
	EMBED: EmbedBlock,
	CODE_BLOCK: CodeBlock,
};

interface PageDesignerBlockProps {
	block: DesignerBlock;
	isActive: boolean;
	onUpdate: (content: Record<string, unknown>) => void;
	onDelete: () => void;
	onDuplicate: () => void;
	onFocus: () => void;
}

export function PageDesignerBlock({
	block,
	isActive,
	onUpdate,
	onDelete,
	onDuplicate,
	onFocus,
}: PageDesignerBlockProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`group relative rounded-lg border transition-all ${
				isDragging ? "opacity-50 shadow-lg" : ""
			} ${isActive ? "border-primary/50 bg-accent/30 ring-1 ring-primary/20" : "border-transparent hover:border-border"}`}
			onClick={onFocus}
		>
			{/* Block header - visible on hover or active */}
			<div
				className={`flex items-center gap-2 px-3 py-1.5 border-b transition-opacity ${
					isActive ? "opacity-100 border-border/50" : "opacity-0 group-hover:opacity-100 border-transparent"
				}`}
			>
				{/* Drag handle */}
				<button
					type="button"
					className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
					{...attributes}
					{...listeners}
				>
					<IconGripVertical className="w-4 h-4" />
				</button>

				{/* Block type label */}
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					{BLOCK_ICONS[block.type]}
					<span>{BLOCK_LABELS[block.type]}</span>
				</div>

				{/* Actions */}
				<div className="ml-auto flex items-center gap-1">
					<Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDuplicate}>
						<IconCopy className="w-3.5 h-3.5" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0 text-destructive hover:text-destructive"
						onClick={onDelete}
					>
						<IconTrash className="w-3.5 h-3.5" />
					</Button>
				</div>
			</div>

			{/* Block content */}
			<div className="p-3">
				{isLayoutBlockType(block.type) ? (
					<ColumnBlock layoutType={block.type as DesignerLayoutBlockType} content={block.content} onChange={onUpdate} />
				) : (
					ELEMENT_COMPONENTS[block.type as DesignerElementBlockType] &&
					React.createElement(ELEMENT_COMPONENTS[block.type as DesignerElementBlockType], {
						content: block.content,
						onChange: onUpdate,
						onFocus,
					})
				)}
			</div>
		</div>
	);
}
