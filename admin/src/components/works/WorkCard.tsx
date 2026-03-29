"use client";

import React from "react";
import Image from "next/image";
import {
	PencilIcon,
	TrashIcon,
	EyeIcon,
	EyeSlashIcon,
	PlayIcon,
	TagIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline";
import { Work } from "../../services/worksService";

interface WorkCardProps {
	work: Work;
	onEdit: () => void;
	onDelete: () => void;
	onPublish: () => void;
}

export const WorkCard: React.FC<WorkCardProps> = ({ work, onEdit, onDelete, onPublish }) => {
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
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
			{/* Thumbnail */}
			<div className="aspect-video bg-gray-100 dark:bg-gray-700 relative">
				{work.previewImage || work.videoFile ? (
					<Image
						src={
							(work.previewImage || work.videoFile)?.images?.medium ||
							(work.previewImage || work.videoFile)?.images?.original ||
							(work.previewImage || work.videoFile)?.images?.thumbnail ||
							""
						}
						alt={work.title}
						fill
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
						className="object-cover"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						<PlayIcon className="h-12 w-12 text-gray-400" />
					</div>
				)}

				{/* Status Badge */}
				<div className="absolute top-2 right-2">
					<span
						className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
							work.status
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
			</div>

			{/* Content */}
			<div className="p-4">
				<div className="flex items-start justify-between mb-2">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{work.title}</h3>
				</div>

				<p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{work.shortDescription}</p>

				<div className="space-y-2 mb-4">
					{/* Client */}
					<div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
						<span className="font-medium">Client:</span>
						<span className="ml-1">{work.client}</span>
					</div>

					{/* Directors */}
					{work.directors.length > 0 && (
						<div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
							<UserGroupIcon className="h-4 w-4 mr-1" />
							<span className="truncate">{work.directors.map((d) => d.director.title).join(", ")}</span>
						</div>
					)}

					{/* Tags */}
					{work.tags.length > 0 && (
						<div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
							<TagIcon className="h-4 w-4 mr-1" />
							<div className="flex flex-wrap gap-1">
								{work.tags.slice(0, 3).map((tag, index) => (
									<span
										key={index}
										className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
									>
										{tag}
									</span>
								))}
								{work.tags.length > 3 && <span className="text-xs text-gray-400">+{work.tags.length - 3} more</span>}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
					<div className="text-xs text-gray-500 dark:text-gray-400">
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
	);
};
