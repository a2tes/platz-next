"use client";

import React from "react";
import type { Block, BlockType } from "../types";
import { cn } from "../utils";
import { BlockVideo } from "./BlockVideo";

export interface BlockRendererProps {
	/** Block data */
	block: Block;
	/** Render mode */
	mode?: "view" | "preview" | "edit";
	/** Storage URL for media files */
	storageUrl?: string;
	/** Custom renderer for work items */
	renderWorkItem?: (workId: number, settings: any) => React.ReactNode;
	/** Custom renderer for animation items */
	renderAnimationItem?: (animationId: number, settings: any) => React.ReactNode;
	/** Additional class name */
	className?: string;
	/** Click handler for edit mode */
	onBlockClick?: (block: Block) => void;
}

export function BlockRenderer({
	block,
	mode = "view",
	storageUrl = "",
	renderWorkItem,
	renderAnimationItem,
	className,
	onBlockClick,
}: BlockRendererProps) {
	const isEditable = mode === "edit";

	const handleClick = () => {
		if (isEditable && onBlockClick) {
			onBlockClick(block);
		}
	};

	// Render based on block type
	const renderContent = () => {
		switch (block.type) {
			case "ONE_COLUMN":
			case "TWO_COLUMN":
			case "THREE_COLUMN":
			case "CUSTOM_COLUMN":
				return renderColumnBlock();
			case "PARAGRAPH":
				return renderParagraphBlock();
			case "QUOTE":
				return renderQuoteBlock();
			case "MEDIA":
				return renderMediaBlock();
			default:
				return <div>Unknown block type: {block.type}</div>;
		}
	};

	const renderColumnBlock = () => {
		const items = block.content.items || [];
		const columnCount = getColumnCount(block.type);

		return (
			<div
				className={cn(
					"grid gap-4",
					columnCount === 1 && "grid-cols-1",
					columnCount === 2 && "grid-cols-2",
					columnCount === 3 && "grid-cols-3",
					block.type === "CUSTOM_COLUMN" && "grid-cols-[auto]", // Let items define their widths
				)}
			>
				{items.map((item, index) => (
					<div key={index} className="relative aspect-video">
						{item.workId && renderWorkItem ? (
							renderWorkItem(item.workId, {
								cropX: item.cropX,
								cropY: item.cropY,
								cropW: item.cropW,
								cropH: item.cropH,
								trimStart: item.trimStart,
								trimEnd: item.trimEnd,
							})
						) : item.animationId && renderAnimationItem ? (
							renderAnimationItem(item.animationId, {
								cropX: item.cropX,
								cropY: item.cropY,
								cropW: item.cropW,
								cropH: item.cropH,
								trimStart: item.trimStart,
								trimEnd: item.trimEnd,
							})
						) : (
							<div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
								{isEditable ? "Click to select work" : "No content"}
							</div>
						)}
					</div>
				))}

				{/* Empty slots in edit mode */}
				{isEditable &&
					items.length < columnCount &&
					Array.from({ length: columnCount - items.length }).map((_, index) => (
						<div
							key={`empty-${index}`}
							className="relative aspect-video border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 cursor-pointer hover:border-gray-400 hover:text-gray-500 transition-colors"
						>
							+ Add Work
						</div>
					))}
			</div>
		);
	};

	const renderParagraphBlock = () => {
		return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: block.content.text || "" }} />;
	};

	const renderQuoteBlock = () => {
		return (
			<blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600">{block.content.text}</blockquote>
		);
	};

	const renderMediaBlock = () => {
		// Single media item block (image or video)
		return (
			<div className="relative">
				{block.content.mediaId ? (
					<div>Media ID: {block.content.mediaId}</div>
				) : (
					<div className="aspect-video bg-gray-200 flex items-center justify-center text-gray-500">
						{isEditable ? "Click to select media" : "No media"}
					</div>
				)}
			</div>
		);
	};

	return (
		<div
			className={cn(
				"block-renderer",
				isEditable && "cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 rounded-lg transition-all",
				className,
			)}
			onClick={handleClick}
		>
			{renderContent()}
		</div>
	);
}

function getColumnCount(type: BlockType): number {
	switch (type) {
		case "ONE_COLUMN":
			return 1;
		case "TWO_COLUMN":
			return 2;
		case "THREE_COLUMN":
			return 3;
		case "CUSTOM_COLUMN":
			return 4; // Max columns for custom
		default:
			return 1;
	}
}
