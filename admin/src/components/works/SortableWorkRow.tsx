"use client";

import React from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	PencilIcon,
	TrashIcon,
	EyeIcon,
	EyeSlashIcon,
	Bars3Icon,
	PlayIcon,
	TagIcon,
} from "@heroicons/react/24/outline";
import { Work } from "../../services/worksService";

interface SortableWorkRowProps {
	work: Work;
	onEdit: () => void;
	onDelete: () => void;
	onPublish: () => void;
}

export const SortableWorkRow: React.FC<SortableWorkRowProps> = ({ work, onEdit, onDelete, onPublish }) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: work.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "PUBLISHED":
				return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
			case "DRAFT":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	return (
		<li ref={setNodeRef} style={style} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
			<div className="px-4 py-4 flex items-center space-x-4">
				{/* Drag Handle */}
				<div
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
				>
					<Bars3Icon className="h-5 w-5" />
				</div>

				{/* Thumbnail */}
				<div className="shrink-0">
					<div className="w-16 h-12 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
						{work.previewImage || work.videoFile ? (
							<Image
								src={
									(work.previewImage || work.videoFile)?.images?.small ||
									(work.previewImage || work.videoFile)?.images?.thumbnail ||
									(work.previewImage || work.videoFile)?.images?.original ||
									""
								}
								alt={work.title}
								width={256}
								height={192}
								className="w-full h-full object-cover"
								unoptimized
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<PlayIcon className="h-6 w-6 text-gray-400" />
							</div>
						)}
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between">
						<div className="flex-1 min-w-0">
							<div className="flex items-center space-x-3">
								<h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{work.title}</h3>
								<span
									className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
										work.status,
									)}`}
								>
									{work.status === "PUBLISHED" ? (
										<EyeIcon className="h-3 w-3 mr-1" />
									) : (
										<EyeSlashIcon className="h-3 w-3 mr-1" />
									)}
									{work.status}
								</span>
							</div>

							<div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
								<span>Client: {work.client}</span>

								{work.tags.length > 0 && (
									<div className="flex items-center">
										<TagIcon className="h-4 w-4 mr-1" />
										<span className="truncate max-w-xs">
											{work.tags.slice(0, 2).join(", ")}
											{work.tags.length > 2 && ` +${work.tags.length - 2}`}
										</span>
									</div>
								)}
							</div>

							<p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{work.shortDescription}</p>
						</div>

						<div className="flex items-center space-x-4">
							<div className="text-sm text-gray-500 dark:text-gray-400">
								{work.status === "PUBLISHED" && work.publishedAt
									? `Published ${formatDate(work.publishedAt)}`
									: `Updated ${formatDate(work.updatedAt)}`}
							</div>

							<div className="flex items-center space-x-1">
								<button
									onClick={onEdit}
									className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
									title="Edit work"
								>
									<PencilIcon className="h-4 w-4" />
								</button>

								<button
									onClick={onPublish}
									className={`p-1.5 transition-colors ${
										work.status === "PUBLISHED"
											? "text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400"
											: "text-gray-400 hover:text-green-600 dark:hover:text-green-400"
									}`}
									title={work.status === "PUBLISHED" ? "Unpublish work" : "Publish work"}
								>
									{work.status === "PUBLISHED" ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
								</button>

								<button
									onClick={onDelete}
									className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
									title="Delete work"
								>
									<TrashIcon className="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</li>
	);
};
