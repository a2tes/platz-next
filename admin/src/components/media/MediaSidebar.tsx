"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	IconX,
	IconEye,
	IconDownload,
	IconTrash,
	IconPhoto,
	IconVideo,
	IconFile,
	IconPhotoOff,
	IconScissors,
	IconLoader2,
	IconCheck,
	IconAlertTriangle,
	IconTrashX,
} from "@tabler/icons-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { MediaService } from "@/services/mediaService";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VideoThumbnailDialog } from "./VideoThumbnailDialog";
import { VideoSettingsModal } from "@/components/blocks/VideoSettingsModal";

export function MediaSidebar() {
	const queryClient = useQueryClient();
	const { sidebarFile, setSidebarFile, deselectFile } = useMediaLibraryStore();
	const [altText, setAltText] = React.useState("");
	const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
	const [isEditingName, setIsEditingName] = React.useState(false);
	const [editedName, setEditedName] = React.useState("");
	const [isThumbnailDialogOpen, setIsThumbnailDialogOpen] = React.useState(false);
	const [isClipModalOpen, setIsClipModalOpen] = React.useState(false);

	// Fetch fresh file data whenever sidebar file changes
	const { data: freshFile } = useQuery({
		queryKey: ["media-file", sidebarFile?.id],
		queryFn: () => MediaService.getFile(sidebarFile!.id),
		enabled: !!sidebarFile,
		staleTime: 0, // Always refetch to get latest data
	});

	// Use fresh file data if available, otherwise use sidebarFile
	const displayFile = freshFile || sidebarFile;

	const isVideo = displayFile?.category === "video";

	// Fetch default clip for video files
	const { data: defaultClip, isLoading: isClipLoading } = useQuery({
		queryKey: ["default-clip", displayFile?.id],
		queryFn: () => MediaService.getDefaultClip(displayFile!.id),
		enabled: !!displayFile && isVideo,
		staleTime: 5000,
		refetchInterval: (query) => {
			// Poll every 5s while clip is processing
			const clip = query.state.data;
			if (clip && (clip.status === "PENDING" || clip.status === "PROCESSING")) {
				return 5000;
			}
			return false;
		},
	});

	// Animate in when sidebar file changes
	const [isVisible, setIsVisible] = React.useState(false);
	React.useEffect(() => {
		if (displayFile) {
			// Small delay for smooth animation
			setTimeout(() => setIsVisible(true), 50);
		} else {
			setIsVisible(false);
		}
	}, [displayFile?.id]);

	// Initialize alt text and name when file changes
	React.useEffect(() => {
		if (displayFile) {
			setAltText(displayFile.altText || "");
			setEditedName(displayFile.originalName || "");
		}
	}, [displayFile?.id]);

	// Update alt text mutation
	const updateAltTextMutation = useMutation({
		mutationFn: (data: { fileId: number; altText: string }) =>
			MediaService.updateFile(data.fileId, { altText: data.altText }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["media-files"] });
		},
	});

	// Update name mutation
	const updateNameMutation = useMutation({
		mutationFn: (data: { fileId: number; originalName: string }) =>
			MediaService.updateFile(data.fileId, { originalName: data.originalName }),
		onSuccess: (updatedFile) => {
			toast.success("File name updated successfully");
			setIsEditingName(false);
			setEditedName(updatedFile.originalName);

			// Update the detail query cache immediately (for the sidebar)
			queryClient.setQueryData(["media-file", updatedFile.id], updatedFile);

			// Also update the sidebar file in the store
			setSidebarFile(updatedFile);

			// Invalidate the media list to refresh the grid
			queryClient.invalidateQueries({ queryKey: ["media-files"] });
		},
		onError: (error: unknown) => {
			if (error && typeof error === "object" && "response" in error) {
				const axiosError = error as {
					response?: {
						data?: { error?: { message?: string }; message?: string };
					};
				};
				const message =
					axiosError.response?.data?.error?.message ||
					axiosError.response?.data?.message ||
					"Failed to update file name";
				toast.error(message);
			} else if (error instanceof Error) {
				toast.error(error.message);
			} else {
				toast.error("Failed to update file name");
			}
		},
	}); // Delete file mutation
	const deleteFileMutation = useMutation({
		mutationFn: (fileId: number) => MediaService.deleteFile(fileId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["media-files"] });
			queryClient.invalidateQueries({ queryKey: ["folder-files"] });
			queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
			// Force MediaViewGrid to reset pagination and refetch
			useMediaLibraryStore.getState().bumpMediaRefreshToken();
			toast.success("File deleted successfully");
			handleClose();
		},
		onError: (error: unknown) => {
			// Handle axios errors
			if (error && typeof error === "object" && "response" in error) {
				const axiosError = error as {
					response?: {
						data?: { error?: { message?: string }; message?: string };
					};
				};
				const message =
					axiosError.response?.data?.error?.message || axiosError.response?.data?.message || "Failed to delete file";
				toast.error(message);
			} else if (error instanceof Error) {
				toast.error(error.message || "Failed to delete file");
			} else {
				toast.error("Failed to delete file");
			}
		},
	});

	const updateThumbnailMutation = useMutation({
		mutationFn: ({
			fileId,
			thumbnailBlob,
			thumbnailTime,
		}: {
			fileId: number;
			thumbnailBlob: Blob;
			thumbnailTime: number;
		}) => MediaService.uploadVideoThumbnail(fileId, thumbnailBlob, thumbnailTime),
		onSuccess: (response) => {
			const updatedFile = response.data;
			queryClient.invalidateQueries({ queryKey: ["media-files"] });
			queryClient.invalidateQueries({
				queryKey: ["media-file", displayFile?.id],
			});
			useMediaLibraryStore.getState().notifyFileUpdated(updatedFile);
			toast.success("Thumbnail updated");
		},
		onError: () => {
			toast.error("Failed to update thumbnail");
		},
	});

	// Create default clip mutation
	const createClipMutation = useMutation({
		mutationFn: (settings: {
			cropSettings?: { x: number; y: number; width: number; height: number; aspect: number };
			trimSettings?: { startTime: number; endTime: number };
		}) => MediaService.createDefaultClip(displayFile!.id, settings),
		onSuccess: () => {
			toast.success("Clip processing started");
			queryClient.invalidateQueries({ queryKey: ["default-clip", displayFile?.id] });
		},
		onError: () => {
			toast.error("Failed to create clip");
		},
	});

	// Delete default clip mutation
	const deleteClipMutation = useMutation({
		mutationFn: () => MediaService.deleteDefaultClip(displayFile!.id),
		onSuccess: () => {
			toast.success("Default clip removed");
			queryClient.invalidateQueries({ queryKey: ["default-clip", displayFile?.id] });
		},
		onError: () => {
			toast.error("Failed to remove clip");
		},
	});

	const handleClose = () => {
		setSidebarFile(null);
	};

	const handleView = () => {
		if (displayFile) {
			if (displayFile.category === "video" && displayFile.video) {
				window.open(displayFile.video.mp4 || displayFile.video.default, "_blank");
			} else {
				window.open(displayFile.images.large || displayFile.images.original, "_blank");
			}
		}
	};

	const handleDownload = () => {
		if (displayFile) {
			// For videos, use the original video file or optimized MP4
			// For images/documents, use the original image URL
			const url =
				displayFile.category === "video" && displayFile.video
					? displayFile.video.original || displayFile.video.mp4 || displayFile.video.default
					: displayFile.images.original;

			window.open(url, "_blank");
		}
	};

	const handleDelete = () => {
		if (displayFile) {
			setShowDeleteDialog(true);
		}
	};

	const handleAltTextSave = () => {
		if (displayFile) {
			updateAltTextMutation.mutate({
				fileId: displayFile.id,
				altText: altText.trim(),
			});
		}
	};

	const formatFileSize = (bytes: number) => {
		const sizes = ["B", "KB", "MB", "GB"];
		if (bytes === 0) return "0 B";
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
	};

	const getFileIcon = (mimeType: string) => {
		if (mimeType.startsWith("image/")) return IconPhoto;
		if (mimeType.startsWith("video/")) return IconVideo;
		return IconFile;
	};

	// Track preview image errors (must be before any early return to satisfy Hooks rules)
	const [previewError, setPreviewError] = React.useState(false);
	React.useEffect(() => {
		// Reset error state when switching files
		setPreviewError(false);
	}, [displayFile?.id]);

	if (!displayFile) return null;

	const FileIcon = getFileIcon(displayFile.mimeType);
	const isImage = displayFile.mimeType.startsWith("image/");

	return (
		<div
			className={`h-full flex flex-col transform transition-all duration-200 ${
				isVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
			}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<h3 className="font-semibold">File Details</h3>
				<div className="flex items-center gap-2">
					{/* Grouped action buttons */}
					<div className="inline-flex rounded-md overflow-hidden">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" onClick={handleView} className="rounded-r-none">
									<IconEye className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent sideOffset={6}>View</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" onClick={handleDownload} className="rounded-none border-l-0">
									<IconDownload className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent sideOffset={6}>Download</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={handleDelete}
									disabled={deleteFileMutation.isPending}
									className="rounded-l-none border-l-0"
								>
									<IconTrash className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent sideOffset={6}>Delete</TooltipContent>
						</Tooltip>
					</div>

					{/* Close button stays separate */}
					<Button variant="ghost" size="sm" onClick={handleClose}>
						<IconX className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{/* Preview */}
				<div className="space-y-2">
					<Label>Preview</Label>
					<div className={`${isImage ? "aspect-square" : ""} rounded-lg overflow-hidden bg-muted border`}>
						{isImage && displayFile.images && (displayFile.images.large || displayFile.images.original) ? (
							previewError ? (
								<div className="w-full h-full flex items-center justify-center">
									<IconPhotoOff className="h-16 w-16 text-muted-foreground" />
								</div>
							) : (
								<Image
									src={displayFile.images.large || displayFile.images.original}
									alt={displayFile.originalName}
									width={300}
									height={300}
									unoptimized
									className="w-full h-full object-cover"
									onError={() => setPreviewError(true)}
								/>
							)
						) : displayFile.category === "video" &&
						  displayFile.video &&
						  (displayFile.video.mp4 || displayFile.video.default) ? (
							<div className="relative group">
								<video
									src={displayFile.video.mp4 || displayFile.video.default}
									className="w-full h-full object-contain"
									loop
									muted
									playsInline
									autoPlay
								>
									Your browser does not support the video tag.
								</video>
								<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
									<Button size="sm" variant="secondary" onClick={() => setIsThumbnailDialogOpen(true)}>
										Set Thumbnail
									</Button>
								</div>
							</div>
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<FileIcon className="h-16 w-16 text-muted-foreground" />
							</div>
						)}
					</div>
					{isVideo && (
						<Button variant="outline" size="sm" className="w-full" onClick={() => setIsThumbnailDialogOpen(true)}>
							Set Video Thumbnail
						</Button>
					)}
				</div>

				{/* Default Clip Section (Videos only) */}
				{isVideo && (
					<div className="space-y-2">
						<Label>Default Clip</Label>
						{isClipLoading ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<IconLoader2 className="h-4 w-4 animate-spin" />
								Loading...
							</div>
						) : defaultClip ? (
							<div className="space-y-2">
								{/* Clip status badge */}
								<div className="flex items-center justify-between">
									{defaultClip.status === "COMPLETED" ? (
										<Badge variant="default" className="gap-1">
											<IconCheck className="h-3 w-3" />
											Ready
										</Badge>
									) : defaultClip.status === "PENDING" || defaultClip.status === "PROCESSING" ? (
										<Badge variant="secondary" className="gap-1">
											<IconLoader2 className="h-3 w-3 animate-spin" />
											Processing...
										</Badge>
									) : (
										<Badge variant="destructive" className="gap-1">
											<IconAlertTriangle className="h-3 w-3" />
											Failed
										</Badge>
									)}
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-muted-foreground hover:text-destructive"
										onClick={() => deleteClipMutation.mutate()}
										disabled={deleteClipMutation.isPending}
										title="Remove default clip"
									>
										<IconTrashX className="h-4 w-4" />
									</Button>
								</div>

								{/* Clip thumbnail preview */}
								{defaultClip.status === "COMPLETED" && defaultClip.thumbnailUrl && (
									<div className="rounded-md overflow-hidden border bg-muted">
										<img
											src={defaultClip.thumbnailUrl}
											alt="Clip thumbnail"
											className="w-full object-cover"
											onError={(e) => {
												(e.target as HTMLImageElement).style.display = "none";
											}}
										/>
									</div>
								)}

								{/* Clip info */}
								<div className="text-xs text-muted-foreground space-y-1">
									{defaultClip.cropSettings && (
										<div>
											Crop: {(defaultClip.cropSettings as any).width?.toFixed(0)}% ×{" "}
											{(defaultClip.cropSettings as any).height?.toFixed(0)}%
										</div>
									)}
									{defaultClip.trimSettings && (
										<div>
											Trim: {formatClipTime((defaultClip.trimSettings as any).startTime)} –{" "}
											{formatClipTime((defaultClip.trimSettings as any).endTime)}
										</div>
									)}
									{!defaultClip.cropSettings && !defaultClip.trimSettings && <div>Re-encoded at 1280px</div>}
								</div>

								{/* Override clip button */}
								<Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setIsClipModalOpen(true)}>
									<IconScissors className="h-4 w-4" />
									Edit Clip Settings
								</Button>
							</div>
						) : (
							<Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setIsClipModalOpen(true)}>
								<IconScissors className="h-4 w-4" />
								Create Default Clip
							</Button>
						)}
					</div>
				)}

				{/* File Info */}
				<div className="space-y-3">
					<Label>File Information</Label>
					<div className="space-y-2 text-sm">
						<div className="flex justify-between items-center gap-2">
							<span className="text-muted-foreground shrink-0">Name:</span>
							{isEditingName ? (
								<div className="flex items-center gap-2 flex-1">
									<input
										type="text"
										value={editedName}
										className="h-min text-sm outline-0 w-full"
										onChange={(e) => setEditedName(e.target.value)}
										autoFocus
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												updateNameMutation.mutate({
													fileId: displayFile.id,
													originalName: editedName,
												});
											} else if (e.key === "Escape") {
												setIsEditingName(false);
												setEditedName(displayFile.originalName || "");
											}
										}}
									/>
									{/* <Input
										value={editedName}
										onChange={(e) => setEditedName(e.target.value)}
										className="h-8 text-sm outline-0 focus-disabled"
										autoFocus
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												updateNameMutation.mutate({
													fileId: displayFile.id,
													originalName: editedName,
												});
											} else if (e.key === "Escape") {
												setIsEditingName(false);
												setEditedName(displayFile.originalName || "");
											}
										}}
									/> */}
									<Button
										size="sm"
										variant="link"
										className="hover:no-underline h-auto p-0"
										onClick={() => {
											updateNameMutation.mutate({
												fileId: displayFile.id,
												originalName: editedName,
											});
										}}
										disabled={updateNameMutation.isPending}
									>
										Save
									</Button>
									<Button
										size="sm"
										variant="link"
										className="h-auto px-0!"
										onClick={() => {
											setIsEditingName(false);
											setEditedName(displayFile.originalName || "");
										}}
									>
										<IconX className="h-4 w-4" />
									</Button>
								</div>
							) : (
								<span
									className="font-medium break-all cursor-pointer hover:text-primary flex-1 text-right"
									onClick={() => setIsEditingName(true)}
									title="Click to edit"
								>
									{displayFile.originalName}
								</span>
							)}
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Size:</span>
							<span>{formatFileSize(displayFile.size)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Type:</span>
							<span>{displayFile.mimeType}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Uploaded:</span>
							<span>{new Date(displayFile.createdAt).toLocaleDateString()}</span>
						</div>
					</div>
				</div>

				{/* Alt Text (Images only) */}
				{isImage && (
					<div className="space-y-2">
						<Label htmlFor="alt-text">Alt Text</Label>
						<div className="space-y-2">
							<Input
								id="alt-text"
								value={altText}
								onChange={(e) => setAltText(e.target.value)}
								placeholder="Describe this image for accessibility..."
							/>
							<Button
								size="sm"
								onClick={handleAltTextSave}
								disabled={updateAltTextMutation.isPending || altText === (displayFile.altText || "")}
							>
								{updateAltTextMutation.isPending ? "Saving..." : "Save Alt Text"}
							</Button>
						</div>
					</div>
				)}

				<Separator />

				{/* Usage: Where this file is referenced */}
				<div className="space-y-3">
					<Label>Usage</Label>
					<MediaFileUsage />
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this file?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete {displayFile.originalName}. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteFileMutation.isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (displayFile) {
									deleteFileMutation.mutate(displayFile.id);
									deselectFile(displayFile.id);
								}
							}}
							className="bg-destructive text-white hover:bg-destructive/90"
							disabled={deleteFileMutation.isPending}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{displayFile && isVideo && (
				<VideoThumbnailDialog
					open={isThumbnailDialogOpen}
					onOpenChange={setIsThumbnailDialogOpen}
					file={displayFile}
					onSave={async (thumbnailBlob, thumbnailTime) => {
						await updateThumbnailMutation.mutateAsync({
							fileId: displayFile.id,
							thumbnailBlob,
							thumbnailTime,
						});
					}}
				/>
			)}

			{/* Video Clip Settings Modal */}
			{displayFile && isVideo && isClipModalOpen && displayFile.video && (
				<VideoSettingsModal
					mediaUrl={displayFile.video.mp4 || displayFile.video.default}
					cropSettings={defaultClip?.cropSettings as any}
					trimSettings={defaultClip?.trimSettings as any}
					onCancel={() => setIsClipModalOpen(false)}
					onSave={(settings) => {
						setIsClipModalOpen(false);
						createClipMutation.mutate(settings);
					}}
				/>
			)}
		</div>
	);
}

function formatClipTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function MediaFileUsage() {
	// Access selected file
	const { sidebarFile } = useMediaLibraryStore();
	const fileId = sidebarFile?.id;

	// Fetch usage details
	const {
		data: usage,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["media-usage", fileId],
		queryFn: () => MediaService.getFileUsage(fileId!),
		enabled: !!fileId,
	});

	if (!fileId) {
		return <div className="text-sm text-muted-foreground">No file selected.</div>;
	}

	if (isLoading) return <div className="text-sm text-muted-foreground">Loading usage…</div>;
	if (isError) return <div className="text-sm text-destructive">Failed to load usage info.</div>;

	if (!usage) return null;

	const hasUsage =
		usage.works.length > 0 ||
		usage.directors.length > 0 ||
		usage.starrings.length > 0 ||
		usage.photography.length > 0 ||
		usage.photographers.length > 0 ||
		usage.contentPages.length > 0 ||
		usage.other?.length > 0;

	if (!hasUsage) {
		return <div className="text-sm text-muted-foreground">Not used anywhere yet.</div>;
	}

	const renderList = (items: any[], label: string) => {
		if (!items.length) return null;
		// Deduplicate items by ID if needed, but here we just show them.
		// Some items might have 'title', others 'name'.
		const titles = items.slice(0, 3).map((i) => i.title || i.name || `ID: ${i.id || i.subjectId}`);
		const more = items.length - titles.length;
		return (
			<div className="text-sm">
				<span className="text-muted-foreground">{label}: </span>
				<span className="font-medium">
					{titles.join(", ")}
					{more > 0 ? ` +${more} more` : ""}
				</span>
			</div>
		);
	};

	return (
		<div className="space-y-2">
			{/* Works */}
			{usage.works.length > 0 && (
				<div className="space-y-1">
					<div className="text-xs uppercase tracking-wide text-muted-foreground">Works</div>
					{renderList(
						usage.works.filter((w: any) => w.usage === "Video"),
						"Videos",
					)}
					{renderList(
						usage.works.filter((w: any) => w.usage === "Preview Image"),
						"Preview Images",
					)}
				</div>
			)}

			{/* Photography */}
			{usage.photography.length > 0 && (
				<div className="space-y-1">
					<div className="text-xs uppercase tracking-wide text-muted-foreground">Photography</div>
					{renderList(
						usage.photography.filter((p: any) => p.usage === "Image"),
						"Images",
					)}
					{renderList(
						usage.photography.filter((p: any) => p.usage === "Preview Image"),
						"Preview Images",
					)}
				</div>
			)}

			{/* People */}
			{(usage.directors.length > 0 || usage.starrings.length > 0 || usage.photographers.length > 0) && (
				<div className="space-y-1">
					<div className="text-xs uppercase tracking-wide text-muted-foreground">People</div>
					{renderList(usage.directors, "Directors")}
					{renderList(usage.starrings, "Starrings")}
					{renderList(usage.photographers, "Photographers")}
				</div>
			)}

			{/* Content Pages */}
			{usage.contentPages.length > 0 && (
				<div className="space-y-1">
					<div className="text-xs uppercase tracking-wide text-muted-foreground">Content Pages</div>
					{renderList(usage.contentPages, "Preview Images")}
				</div>
			)}

			{/* Other */}
			{usage.other?.length > 0 && (
				<div className="space-y-1">
					<div className="text-xs uppercase tracking-wide text-muted-foreground">Other</div>
					{renderList(usage.other, "Crops/Other")}
				</div>
			)}
		</div>
	);
}
