"use client";

import { Block, BlockContentItem } from "@/lib/blocks";
import { BlockVideo } from "./BlockVideo";

export interface BlockClickRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

interface BlockRendererProps {
	blocks: Block[];
	className?: string;
	onWorkClick?: (item: BlockContentItem, rect?: BlockClickRect) => void;
	onItemClick?: (item: BlockContentItem, rect?: BlockClickRect) => void;
}

interface BlockItemRendererProps {
	block: Block;
	onItemClick?: (item: BlockContentItem, rect?: BlockClickRect) => void;
}

/** Get the entity data from a block item — either work or animation */
function getEntity(item: BlockContentItem) {
	return item.work || item.animation || null;
}

function BlockItemRenderer({ block, onItemClick }: BlockItemRendererProps) {
	// Grid classes based on block type
	const gridClass = {
		ONE_COLUMN: "grid-cols-1",
		TWO_COLUMN: "grid-cols-1 md:grid-cols-2",
		THREE_COLUMN: "grid-cols-1 md:grid-cols-3",
		FOUR_COLUMN: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
		ONE_TWO: "grid-cols-1 md:grid-cols-3",
		TWO_ONE: "grid-cols-1 md:grid-cols-3",
	}[block.type];

	return (
		<div className={`grid ${gridClass} gap-0`}>
			{block.content.map((item, slotIndex) => {
				const entity = item ? getEntity(item) : null;
				if (!item || !entity) return null;

				// Handle ONE_TWO and TWO_ONE special grid spans
				let spanClass = "";
				if (block.type === "ONE_TWO") {
					spanClass = slotIndex === 0 ? "md:col-span-1" : "md:col-span-2";
				} else if (block.type === "TWO_ONE") {
					spanClass = slotIndex === 0 ? "md:col-span-2" : "md:col-span-1";
				}

				const isClickable = entity.slug && onItemClick;
				// Show as video only if display is not "thumbnail" and there's a video URL
				const isVideo = item.display !== "thumbnail" && !!entity.videoUrl;

				const mediaContent = isVideo ? (
					<BlockVideo item={item} />
				) : (
					<img
						src={entity.thumbnailUrl || entity.thumbnail || ""}
						alt={entity.title || ""}
						className="w-full h-full object-cover"
						loading="lazy"
					/>
				);

				if (isClickable) {
					return (
						<button
							key={slotIndex}
							onClick={(e) => {
								const rect = e.currentTarget.getBoundingClientRect();
								onItemClick(item, {
									top: rect.top,
									left: rect.left,
									width: rect.width,
									height: rect.height,
								});
							}}
							className={`relative group cursor-pointer overflow-hidden ${spanClass} scale-[1.002]`}
							type="button"
						>
							{mediaContent}
							{/* Hover overlay with title */}
							<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
								<span className="text-white text-lg font-medium">{entity.title}</span>
							</div>
						</button>
					);
				}

				return (
					<div key={slotIndex} className={`overflow-hidden ${spanClass} scale-[1.002]`}>
						{mediaContent}
					</div>
				);
			})}
		</div>
	);
}

export function BlockRenderer({ blocks, className = "", onWorkClick, onItemClick }: BlockRendererProps) {
	if (!blocks || blocks.length === 0) {
		return null;
	}

	// Sort blocks by sortOrder
	const sortedBlocks = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
	// Support both legacy onWorkClick and new onItemClick
	const clickHandler = onItemClick || onWorkClick;

	return (
		<div className={className}>
			{sortedBlocks.map((block) => (
				<BlockItemRenderer key={block.id} block={block} onItemClick={clickHandler} />
			))}
		</div>
	);
}
