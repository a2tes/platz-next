"use client";

import * as React from "react";
import Image from "next/image";
// import { IconGripVertical } from "@tabler/icons-react";
import { PhotographyItem } from "@/services/photographyItemsService";

export type ImageItemCardMode = "photographer" | "category";

export interface Option {
	label: string;
	value: string;
}

export function ImageItemCard({
	item,
	onEdit,
	onDelete,
	onTogglePublish,
	mode,
	options,
	dragHandleProps,
}: {
	item: PhotographyItem;
	onEdit: () => void;
	onDelete: () => void;
	onTogglePublish: () => void;
	mode: ImageItemCardMode; // parent context
	options: Option[]; // list of the OTHER side (categories if mode=photographer, photographers if mode=category)
	dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
	const relatedName = React.useMemo(() => {
		const id = mode === "photographer" ? item.categoryId : item.photographerId;
		const found = options.find((o) => Number(o.value) === Number(id));
		return found?.label?.trim();
	}, [mode, item.categoryId, item.photographerId, options]);
	return (
		<div
			className={`group relative rounded-md border p-3 flex items-center gap-4 cursor-grab`}
			{...(dragHandleProps || {})}
		>
			<div
				className={`absolute top-4 right-4 w-2 h-2 rounded-full ${
					item.status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"
				}`}
			></div>
			{/* Thumbnail */}
			<div className="w-20 h-14 bg-muted rounded overflow-hidden shrink-0 hover:cursor-pointer" onClick={onEdit}>
				{item.image?.images?.small ? (
					<Image
						src={item.image.images.small || item.image.images.thumbnail}
						alt={item.title || item.image.originalName || "Image"}
						width={160}
						height={112}
						className="w-full h-full object-cover"
						unoptimized
					/>
				) : (
					<div className="w-full h-full" />
				)}
			</div>

			{/* Minimal info */}
			<div className="flex-1 min-w-0">
				<div className="font-medium truncate">{item.title || item.image?.originalName || "Untitled"}</div>
				<div className="text-xs text-muted-foreground truncate">
					{[relatedName, item.client?.trim(), item.year ? String(item.year) : undefined, item.location?.trim()]
						.filter(Boolean)
						.join(" · ")}
				</div>
				{/* Hover action links */}
				<div className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground flex items-center gap-2 mt-1">
					<button
						className="hover:cursor-pointer hover:underline hover:text-foreground"
						onClick={(e) => {
							e.stopPropagation();
							onEdit();
						}}
					>
						Edit
					</button>
					<span className="text-muted-foreground/50">|</span>
					<button
						className="hover:cursor-pointer hover:underline hover:text-foreground"
						onClick={(e) => {
							e.stopPropagation();
							onTogglePublish();
						}}
					>
						{item.status === "PUBLISHED" ? "Unpublish" : "Publish"}
					</button>
					<span className="text-muted-foreground/50">|</span>
					<button
						className="hover:cursor-pointer hover:underline text-destructive"
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
}
