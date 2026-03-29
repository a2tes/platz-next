"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	IconScissors,
	IconLoader2,
	IconGrid3x3,
	IconList,
	IconX,
	IconEye,
	IconTrash,
	IconRefresh,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { MediaService } from "@/services/mediaService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
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
interface ClipJob {
	id: string;
	sourceMediaId: number;
	contextType?: string;
	contextId?: number;
	slotIndex?: number;
	workId?: number;
	isDefault: boolean;
	cropSettings?: { x: number; y: number; width: number; height: number; aspect: number; aspectLabel?: string };
	trimSettings?: { startTime: number; endTime: number };
	settingsHash: string;
	maxDimension: number;
	quality: string;
	status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
	progress: number;
	errorMessage?: string;
	outputUrl?: string;
	thumbnailUrl?: string;
	outputMetadata?: { width: number; height: number; duration: number; size: number };
	createdAt: string;
	updatedAt: string;
	sourceMedia?: {
		id: number;
		uuid: string;
		filename: string;
		originalName: string;
		mimeType: string;
	};
	work?: {
		id: number;
		title: string;
		slug: string;
	};
}

const statusConfig: Record<string, { label: string; textColor: string }> = {
	COMPLETED: { label: "Completed", textColor: "text-green-600" },
	PROCESSING: { label: "Processing", textColor: "text-blue-600" },
	PENDING: { label: "Pending", textColor: "text-yellow-600" },
	FAILED: { label: "Failed", textColor: "text-red-600" },
};

const ASPECT_PRESETS: { label: string; value: number }[] = [
	{ label: "Ultra Widescreen (21:9)", value: 21 / 9 },
	{ label: "Standard Widescreen (16:9)", value: 16 / 9 },
	{ label: "Modern Cinematic (2:1)", value: 2 },
	{ label: "Photo (3:2)", value: 3 / 2 },
	{ label: "Poster (5:4)", value: 5 / 4 },
	{ label: "Classic (4:3)", value: 4 / 3 },
	{ label: "Square (1:1)", value: 1 },
	{ label: "Social Portrait (4:5)", value: 4 / 5 },
	{ label: "Classic Portrait (3:4)", value: 3 / 4 },
	{ label: "Portrait Photo (2:3)", value: 2 / 3 },
	{ label: "Story / Reel (9:16)", value: 9 / 16 },
	{ label: "Vertical Poster (1:2)", value: 1 / 2 },
];

function formatAspectRatio(aspect: number): string {
	if (!aspect || aspect === 0) return "Freeform";
	for (const preset of ASPECT_PRESETS) {
		if (Math.abs(aspect - preset.value) < 0.01) {
			return preset.label;
		}
	}
	return "Freeform";
}

function formatDuration(seconds: number) {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
	const sizes = ["B", "KB", "MB", "GB"];
	if (bytes === 0) return "0 B";
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

function ClipGridItem({
	clip,
	isSelected,
	onSelect,
}: {
	clip: ClipJob;
	isSelected: boolean;
	onSelect: (clip: ClipJob) => void;
}) {
	const config = statusConfig[clip.status] || statusConfig.PENDING;

	return (
		<div
			className={`relative group cursor-pointer rounded-lg border bg-card transition-all duration-200 p-1 ring-2 ring-inset ${isSelected ? "ring-primary shadow-lg" : "ring-transparent hover:shadow-md"}`}
			onClick={() => onSelect(clip)}
		>
			{/* Thumbnail / Preview */}
			<div className="relative aspect-video bg-muted rounded-t-md overflow-hidden">
				{clip.thumbnailUrl ? (
					<img
						src={clip.thumbnailUrl}
						alt={clip.sourceMedia?.originalName || "Clip"}
						loading="lazy"
						decoding="async"
						className="object-cover absolute inset-0 w-full h-full"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<IconScissors className="h-8 w-8 text-muted-foreground/50" />
					</div>
				)}

				{/* Default badge */}
				{clip.isDefault && (
					<div className="absolute top-2 left-2">
						<Badge variant="secondary" className="text-[10px]">
							Default
						</Badge>
					</div>
				)}

				{/* Duration overlay */}
				{clip.outputMetadata?.duration && (
					<div className="absolute bottom-2 right-2 rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5">
						{formatDuration(clip.outputMetadata.duration)}
					</div>
				)}
			</div>

			{/* Info */}
			<div className="p-3 space-y-1.5">
				<div className="text-xs font-medium truncate" title={clip.sourceMedia?.originalName}>
					{clip.sourceMedia?.originalName || "Unknown source"}
				</div>

				{/* Clip details */}
				<div className="flex flex-wrap gap-1">
					{clip.cropSettings && (
						<span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">Crop</span>
					)}
					{clip.trimSettings && (
						<span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
							{formatDuration(clip.trimSettings.startTime)} - {formatDuration(clip.trimSettings.endTime)}
						</span>
					)}
					{clip.outputMetadata && (
						<span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
							{clip.outputMetadata.width}×{clip.outputMetadata.height}
						</span>
					)}
				</div>

				{/* Size, date, and status */}
				<div className="flex items-center justify-between text-[10px] text-muted-foreground">
					<span>
						{clip.outputMetadata?.size ? formatFileSize(clip.outputMetadata.size) + " • " : ""}
						{new Date(clip.createdAt).toLocaleDateString()}
					</span>
					<span className={config.textColor}>{config.label}</span>
				</div>
			</div>
		</div>
	);
}

function ClipListItem({
	clip,
	isSelected,
	onSelect,
}: {
	clip: ClipJob;
	isSelected: boolean;
	onSelect: (clip: ClipJob) => void;
}) {
	const config = statusConfig[clip.status] || statusConfig.PENDING;

	return (
		<div
			className={`flex items-center gap-3 rounded-lg border bg-card p-3 transition-all cursor-pointer ${isSelected ? "ring-2 ring-inset ring-primary shadow-lg" : "hover:ring-1 hover:ring-inset hover:ring-muted-foreground/20 hover:shadow-md"}`}
			onClick={() => onSelect(clip)}
		>
			{/* Thumbnail */}
			<div className="relative w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
				{clip.thumbnailUrl ? (
					<img
						src={clip.thumbnailUrl}
						alt={clip.sourceMedia?.originalName || "Clip"}
						loading="lazy"
						className="object-cover absolute inset-0 w-full h-full"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<IconScissors className="h-5 w-5 text-muted-foreground/50" />
					</div>
				)}
			</div>

			{/* Info */}
			<div className="flex-1 min-w-0">
				<div className="text-sm font-medium truncate">{clip.sourceMedia?.originalName || "Unknown source"}</div>
				<div className="text-xs text-muted-foreground flex items-center gap-2">
					{clip.outputMetadata?.duration && <span>{formatDuration(clip.outputMetadata.duration)}</span>}
					{clip.outputMetadata && (
						<span>
							{clip.outputMetadata.width}×{clip.outputMetadata.height}
						</span>
					)}
					{clip.work && <span>• {clip.work.title}</span>}
				</div>
			</div>

			{/* Status */}
			<span className={`text-[10px] shrink-0 ${config.textColor}`}>{config.label}</span>

			{/* Default badge */}
			{clip.isDefault && (
				<Badge variant="secondary" className="text-[10px] shrink-0">
					Default
				</Badge>
			)}

			{/* Date */}
			<div className="text-xs text-muted-foreground shrink-0">{new Date(clip.createdAt).toLocaleDateString()}</div>
		</div>
	);
}

export function ClipsView() {
	const queryClient = useQueryClient();
	const [page, setPage] = React.useState(1);
	const [allClips, setAllClips] = React.useState<ClipJob[]>([]);
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
	const [selectedClip, setSelectedClip] = React.useState<ClipJob | null>(null);
	const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
	const { searchQuery } = useMediaLibraryStore();

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["all-clips", page, searchQuery],
		queryFn: () =>
			MediaService.getAllClips({
				page,
				limit: 24,
				search: searchQuery || undefined,
			}),
	});

	// Accumulate for infinite scroll
	React.useEffect(() => {
		if (data?.data) {
			if (page === 1) {
				setAllClips(data.data);
			} else {
				setAllClips((prev) => {
					const ids = new Set(prev.map((c) => c.id));
					return [...prev, ...data.data.filter((c: ClipJob) => !ids.has(c.id))];
				});
			}
		}
	}, [data, page]);

	// Reset on search change — only reset page, let the accumulation effect
	// handle replacing allClips when new data arrives.  Previously this also
	// called setAllClips([]), which caused a race condition: clearing the list
	// after the accumulation effect had already populated it from cached data.
	React.useEffect(() => {
		setPage(1);
	}, [searchQuery]);

	// Keep selectedClip in sync with latest data from allClips
	React.useEffect(() => {
		if (selectedClip) {
			const updated = allClips.find((c) => c.id === selectedClip.id);
			if (updated && updated !== selectedClip) {
				setSelectedClip(updated);
			}
		}
	}, [allClips, selectedClip]);

	// Clip usage query
	const { data: usageData, isLoading: isUsageLoading } = useQuery({
		queryKey: ["clip-usage", selectedClip?.id],
		queryFn: () => MediaService.getClipUsage(selectedClip!.id),
		enabled: !!selectedClip,
	});

	// Delete clip mutation
	const deleteClipMutation = useMutation({
		mutationFn: (clipId: string) => MediaService.deleteClip(clipId),
		onSuccess: () => {
			toast.success("Clip deleted successfully");
			setSelectedClip(null);
			setShowDeleteDialog(false);
			queryClient.invalidateQueries({ queryKey: ["all-clips"] });
		},
		onError: (error: unknown) => {
			if (error && typeof error === "object" && "response" in error) {
				const axiosError = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
				const message =
					axiosError.response?.data?.error?.message || axiosError.response?.data?.message || "Failed to delete clip";
				toast.error(message);
			} else {
				toast.error("Failed to delete clip");
			}
			setShowDeleteDialog(false);
		},
	});

	// Retry clip mutation
	const retryClipMutation = useMutation({
		mutationFn: (clipId: string) => MediaService.retryClip(clipId),
		onSuccess: () => {
			toast.success("Clip job requeued for processing");
			queryClient.invalidateQueries({ queryKey: ["all-clips"] });
		},
		onError: () => {
			toast.error("Failed to retry clip");
		},
	});

	const totalUsage = usageData
		? usageData.homepageDirectors.length + usageData.directorsPageSelections.length + usageData.blocks.length
		: 0;
	const isInUse = totalUsage > 0;

	// Infinite scroll
	const sentinelRef = React.useRef<HTMLDivElement | null>(null);
	const isFetchingRef = React.useRef(isFetching);
	isFetchingRef.current = isFetching;
	const paginationRef = React.useRef<{ page: number; totalPages: number }>({ page: 0, totalPages: 0 });

	React.useEffect(() => {
		if (data?.meta?.pagination) {
			paginationRef.current = {
				page: data.meta.pagination.page,
				totalPages: data.meta.pagination.totalPages,
			};
		}
	}, [data]);

	React.useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		const scrollContainer = sentinel.closest("[data-clips-scroll]") as HTMLElement | null;
		if (!scrollContainer) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry?.isIntersecting) return;

				const { page: currentPage, totalPages } = paginationRef.current;
				if (isFetchingRef.current || currentPage <= 0 || currentPage >= totalPages) return;

				setPage((prev) => prev + 1);
			},
			{
				root: scrollContainer,
				rootMargin: "0px 0px 400px 0px",
			},
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [allClips.length]);

	if (isLoading && page === 1) {
		return (
			<div className="space-y-4 p-4">
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{[...Array(12)].map((_, i) => (
						<div key={i} className="rounded-lg">
							<Skeleton className="aspect-video rounded-md" />
							<div className="p-2 space-y-2">
								<Skeleton className="h-3 w-3/4" />
								<Skeleton className="h-3 w-1/2" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	const totalCount = data?.meta?.pagination?.total || 0;

	const handleSelectClip = (clip: ClipJob) => {
		setSelectedClip((prev) => (prev?.id === clip.id ? null : clip));
	};

	return (
		<div className="relative h-full" data-cid="ClipsView">
			<div
				className={`flex flex-col h-full px-4 pt-4 transition-all duration-300 ease-in-out ${selectedClip ? "mr-80" : "mr-0"}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between pb-4 shrink-0 bg-background">
					<div>
						<h2 className="text-lg font-semibold">All Clips</h2>
						<div className="text-sm text-muted-foreground">
							{totalCount} clip{totalCount !== 1 ? "s" : ""}
						</div>
					</div>

					<div className="flex items-center space-x-2">
						<Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
							<IconGrid3x3 className="h-4 w-4" />
						</Button>
						<Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
							<IconList className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto" data-clips-scroll>
					{allClips.length === 0 && !isLoading && !isFetching ? (
						<div className="text-center py-12">
							<IconScissors className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
							<div className="text-muted-foreground">
								No clips found
								{searchQuery && ` for "${searchQuery}"`}
							</div>
						</div>
					) : viewMode === "grid" ? (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
							{allClips.map((clip) => (
								<ClipGridItem
									key={clip.id}
									clip={clip}
									isSelected={selectedClip?.id === clip.id}
									onSelect={handleSelectClip}
								/>
							))}
						</div>
					) : (
						<div className="space-y-2">
							{allClips.map((clip) => (
								<ClipListItem
									key={clip.id}
									clip={clip}
									isSelected={selectedClip?.id === clip.id}
									onSelect={handleSelectClip}
								/>
							))}
						</div>
					)}

					{/* Infinite scroll sentinel */}
					<div ref={sentinelRef} className="h-8" />

					{/* Loading more indicator */}
					{isFetching && page > 1 && (
						<div className="flex justify-center py-4">
							<IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					)}
				</div>
			</div>

			{/* Clip Details Sidebar */}
			<div
				className={`absolute right-0 top-0 bottom-0 w-80 bg-background border-l z-20 transform transition-transform duration-300 ease-in-out ${
					selectedClip ? "translate-x-0" : "translate-x-full"
				}`}
			>
				{selectedClip && (
					<div className="h-full flex flex-col">
						{/* Sidebar Header */}
						<div className="flex items-center justify-between p-4 border-b shrink-0">
							<h3 className="text-sm font-semibold">Clip Details</h3>
							<div className="flex items-center gap-1">
								{selectedClip.outputUrl && (
									<Button variant="ghost" size="icon" className="h-7 w-7" asChild>
										<a href={selectedClip.outputUrl} target="_blank" rel="noopener noreferrer">
											<IconEye className="h-4 w-4" />
										</a>
									</Button>
								)}
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-destructive hover:text-destructive"
									disabled={isInUse}
									onClick={() => setShowDeleteDialog(true)}
									title={isInUse ? "Cannot delete: clip is in use" : "Delete clip"}
								>
									<IconTrash className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedClip(null)}>
									<IconX className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Sidebar Content */}
						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{/* Preview */}
							<div className="rounded-lg overflow-hidden bg-muted border">
								{selectedClip.status === "COMPLETED" && selectedClip.outputUrl ? (
									<video
										key={selectedClip.id}
										src={selectedClip.outputUrl}
										className="w-full aspect-video object-contain bg-black"
										poster={selectedClip.thumbnailUrl || undefined}
										loop
										muted
										playsInline
										autoPlay
									/>
								) : selectedClip.thumbnailUrl ? (
									<img
										src={selectedClip.thumbnailUrl}
										alt="Clip preview"
										className="w-full aspect-video object-cover"
									/>
								) : (
									<div className="w-full aspect-video flex items-center justify-center">
										<IconScissors className="h-10 w-10 text-muted-foreground/40" />
									</div>
								)}
							</div>

							{/* Failed: error + retry */}
							{selectedClip.status === "FAILED" && (
								<div className="space-y-2">
									{selectedClip.errorMessage && (
										<div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
											<p className="text-xs text-red-600">{selectedClip.errorMessage}</p>
										</div>
									)}
									<Button
										variant="outline"
										size="sm"
										className="w-full h-7 text-xs"
										disabled={retryClipMutation.isPending}
										onClick={() => retryClipMutation.mutate(selectedClip.id)}
									>
										<IconRefresh className={`h-3.5 w-3.5 mr-1 ${retryClipMutation.isPending ? "animate-spin" : ""}`} />
										Retry
									</Button>
								</div>
							)}

							<Separator />

							{/* Source Info */}
							<div className="space-y-2">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</h4>
								<div className="text-sm truncate" title={selectedClip.sourceMedia?.originalName}>
									{selectedClip.sourceMedia?.originalName || "Unknown"}
								</div>
								{selectedClip.work && (
									<a
										href={`/works/${selectedClip.work.id}/edit`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-primary hover:underline block truncate"
									>
										{selectedClip.work.title}
									</a>
								)}
							</div>

							{/* Clip Settings */}
							{(selectedClip.cropSettings || selectedClip.trimSettings) && (
								<>
									<Separator />
									<div className="space-y-2">
										<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Settings</h4>
										{selectedClip.cropSettings && (
											<div className="text-xs text-muted-foreground">
												{selectedClip.cropSettings.aspectLabel || formatAspectRatio(selectedClip.cropSettings.aspect)}
											</div>
										)}
										{selectedClip.trimSettings && (
											<div className="text-xs text-muted-foreground">
												Trim: {formatDuration(selectedClip.trimSettings.startTime)} –{" "}
												{formatDuration(selectedClip.trimSettings.endTime)}
											</div>
										)}
									</div>
								</>
							)}

							{/* Output Info */}
							{selectedClip.outputMetadata && (
								<>
									<Separator />
									<div className="space-y-2">
										<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output</h4>
										<div className="grid grid-cols-2 gap-2 text-xs">
											<div>
												<span className="text-muted-foreground">Resolution</span>
												<div>
													{selectedClip.outputMetadata.width}×{selectedClip.outputMetadata.height}
												</div>
											</div>
											<div>
												<span className="text-muted-foreground">Duration</span>
												<div>{formatDuration(selectedClip.outputMetadata.duration)}</div>
											</div>
											{selectedClip.outputMetadata.size && (
												<div>
													<span className="text-muted-foreground">Size</span>
													<div>{formatFileSize(selectedClip.outputMetadata.size)}</div>
												</div>
											)}
											<div>
												<span className="text-muted-foreground">Quality</span>
												<div className="capitalize">{selectedClip.quality}</div>
											</div>
										</div>
									</div>
								</>
							)}

							{/* Dates */}
							<Separator />
							<div className="space-y-1 text-xs">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Created</span>
									<span>{new Date(selectedClip.createdAt).toLocaleString()}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Updated</span>
									<span>{new Date(selectedClip.updatedAt).toLocaleString()}</span>
								</div>
								{selectedClip.isDefault && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Type</span>
										<Badge variant="secondary" className="text-[10px]">
											Default
										</Badge>
									</div>
								)}
							</div>

							{/* Usage */}
							<Separator />
							<div className="space-y-2">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Usage</h4>
								{isUsageLoading ? (
									<div className="space-y-1.5">
										<Skeleton className="h-3 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								) : usageData ? (
									<div className="space-y-1.5 text-xs">
										{totalUsage === 0 ? (
											<div className="text-muted-foreground">Not used anywhere yet.</div>
										) : (
											<ul className="space-y-1">
												{usageData.homepageDirectors.map((hd) => (
													<li key={`hd-${hd.id}`}>
														<a
															href="/homepage"
															target="_blank"
															rel="noopener noreferrer"
															className="text-primary hover:underline"
														>
															Homepage — {hd.director?.title || "Director"}
															{hd.work ? ` (${hd.work.title})` : ""}
														</a>
													</li>
												))}
												{usageData.directorsPageSelections.map((dp) => (
													<li key={`dp-${dp.id}`}>
														<a
															href={dp.director ? `/directors` : "#"}
															target="_blank"
															rel="noopener noreferrer"
															className="text-primary hover:underline"
														>
															Directors Page — {dp.director?.title || "Director"}
															{dp.work ? ` (${dp.work.title})` : ""}
														</a>
													</li>
												))}
												{usageData.blocks.map((b) => (
													<li key={`b-${b.id}`}>
														<a
															href={
																b.modelName === "work" && b.modelId
																	? `/works/${b.modelId}/edit`
																	: b.modelName === "director" && b.modelId
																		? `/works/directors/${b.modelId}/edit`
																		: "#"
															}
															target="_blank"
															rel="noopener noreferrer"
															className="text-primary hover:underline"
														>
															{b.modelTitle || b.modelName} — Block Editor
														</a>
													</li>
												))}
											</ul>
										)}
									</div>
								) : null}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Clip</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this clip? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleteClipMutation.isPending}
							onClick={() => selectedClip && deleteClipMutation.mutate(selectedClip.id)}
						>
							{deleteClipMutation.isPending ? (
								<IconLoader2 className="h-4 w-4 animate-spin mr-1" />
							) : (
								<IconTrash className="h-4 w-4 mr-1" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
