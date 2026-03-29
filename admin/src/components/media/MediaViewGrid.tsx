"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
	IconPhoto,
	IconVideo,
	IconFile,
	IconGrid3x3,
	IconList,
	IconPhotoOff,
	IconPlayerPlay,
	IconLoader2,
	IconAlertCircle,
	IconCheck,
	IconSparkles,
} from "@tabler/icons-react";

import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { MediaService } from "@/services/mediaService";
import { MediaFile } from "@/services/mediaService";
import { imgixLoader } from "@/lib/imageLoader";
import { useProcessingVideosPolling } from "@/hooks/useProcessingVideosPolling";

// Helpers used by multiple components
const getFileIcon = (mimeType: string) => {
	if (mimeType.startsWith("image/")) return IconPhoto;
	if (mimeType.startsWith("video/")) return IconVideo;
	return IconFile;
};

const formatFileSize = (bytes: number) => {
	const sizes = ["B", "KB", "MB", "GB"];
	if (bytes === 0) return "0 B";
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

// Filter files based on selection filter
const filterFilesBySelectionFilter = (
	files: MediaFile[],
	filter?: "image" | "video" | "document" | "all",
): MediaFile[] => {
	if (!filter || filter === "all") return files;

	return files.filter((file) => {
		if (filter === "image") return file.mimeType.startsWith("image/");
		if (filter === "video") return file.mimeType.startsWith("video/");
		if (filter === "document") return !file.mimeType.startsWith("image/") && !file.mimeType.startsWith("video/");
		return true;
	});
};

// Memoized grid item to avoid re-renders of all items on sidebar/selection changes
const MediaGridItem = React.memo(
	function MediaGridItem({
		file,
		isFoldersTab,
		isCheckboxSelected,
		isSelected,
		onClick,
		onCheckboxToggle,
		subPath,
	}: {
		file: MediaFile;
		isFoldersTab: boolean;
		isCheckboxSelected: boolean;
		isSelected: boolean;
		onClick: (e: React.MouseEvent) => void;
		onCheckboxToggle: (e: React.MouseEvent) => void;
		subPath?: string | null;
	}) {
		const FileIcon = getFileIcon(file.mimeType);
		const [hasError, setHasError] = React.useState(false);

		const imageSrc = file.images && (file.images.small || file.images.thumbnail || file.images.original);

		// Note: Skeleton overlay removed for grid items; basic error state remains.

		return (
			<div
				className={`relative group cursor-pointer rounded-lg transition-all duration-200 transform transform-gpu ${
					isSelected
						? "ring-2 ring-inset ring-primary bg-primary/10 shadow-lg"
						: "hover:ring-1 hover:ring-inset hover:ring-muted-foreground/20 hover:shadow-md"
				}`}
				onClick={onClick}
			>
				{/* Circle Checkbox for folders tab - hover to show */}
				{isFoldersTab && (
					<div
						data-checkbox
						className={`absolute top-2 right-2 z-10 transition-opacity ${
							isCheckboxSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
						}`}
						onClick={onCheckboxToggle}
					>
						<div className="w-6 h-6 rounded-md bg-white/95 dark:bg-gray-800/95 border-2 border-gray-400 dark:border-gray-500 shadow-lg backdrop-blur-sm flex items-center justify-center hover:scale-110 hover:border-primary transition-all">
							<Checkbox checked={!!isCheckboxSelected} className="border-0 w-4 h-4" />
						</div>
					</div>
				)}

				<div className="relative aspect-square rounded-md overflow-hidden bg-muted m-1 mb-0">
					{file.mimeType.startsWith("image/") && imageSrc ? (
						<>
							{!hasError ? (
								<img
									src={imgixLoader({ src: imageSrc, width: 250 })}
									alt={file.originalName}
									loading="lazy"
									decoding="async"
									className="object-cover absolute inset-0 w-full h-full rounded-lg"
									onError={() => setHasError(true)}
								/>
							) : (
								<div className="absolute inset-0 flex items-center justify-center bg-muted">
									<IconPhotoOff className="h-10 w-10 text-muted-foreground" />
								</div>
							)}
							{/* Subfolder badge */}
							{subPath ? (
								<div className="absolute left-2 top-2 z-10 rounded bg-black/60 text-white text-[10px] px-2 py-0.5 max-w-[75%] truncate">
									{subPath}
								</div>
							) : null}
						</>
					) : file.mimeType.startsWith("video/") ? (
						<>
							{file.images?.small ? (
								<img
									src={file.images?.small}
									alt={file.originalName}
									loading="lazy"
									decoding="async"
									className="object-cover absolute inset-0 w-full h-full "
								/>
							) : (
								<div className="absolute inset-0 flex items-center justify-center bg-muted">
									<IconVideo className="h-10 w-10 text-muted-foreground" />
								</div>
							)}
							{/* Video indicator icon */}
							<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-white/50 backdrop-blur-sm p-1 w-1/4 aspect-square flex items-center justify-center">
								<IconPlayerPlay className="h-3/4 w-3/4 text-gray-600" />
							</div>
							{/* Video processing status badge */}
							{file.processingStatus && file.processingStatus !== "completed" && (
								<div
									className={`absolute bottom-2 left-2 z-10 rounded px-2 py-1 text-[10px] font-medium flex items-center gap-1 ${
										file.processingStatus === "processing"
											? "bg-blue-500 text-white"
											: file.processingStatus === "pending"
												? "bg-yellow-500 text-black"
												: file.processingStatus === "failed"
													? "bg-red-500 text-white"
													: ""
									}`}
									title={file.processingError || undefined}
								>
									{file.processingStatus === "processing" && (
										<>
											<IconLoader2 className="h-3 w-3 animate-spin" />
											Optimizing...
										</>
									)}
									{file.processingStatus === "pending" && (
										<>
											<IconLoader2 className="h-3 w-3" />
											Pending
										</>
									)}
									{file.processingStatus === "failed" && (
										<>
											<IconAlertCircle className="h-3 w-3" />
											Failed
										</>
									)}
								</div>
							)}
							{/* Clip indicator */}
							{file.hasClips && (
								<div className="absolute top-2 left-2 z-10" title="Has clips">
									<IconSparkles
										className="h-4 w-4 text-amber-400 drop-shadow-sm"
										fill="currentColor"
										strokeWidth={1.5}
									/>
								</div>
							)}
						</>
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<FileIcon className="h-12 w-12 text-muted-foreground" />
						</div>
					)}
				</div>

				<div className="p-2">
					<div className="text-xs font-medium truncate" title={file.originalName}>
						{file.originalName}
					</div>
					<div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
				</div>
			</div>
		);
	},
	(prev, next) => {
		// Ignore function prop identity; compare only meaningful props
		return (
			prev.file.id === next.file.id &&
			prev.file.processingStatus === next.file.processingStatus &&
			prev.file.images?.small === next.file.images?.small &&
			prev.file.hasClips === next.file.hasClips &&
			prev.isFoldersTab === next.isFoldersTab &&
			prev.isCheckboxSelected === next.isCheckboxSelected &&
			prev.isSelected === next.isSelected
		);
	},
);

// Memoized list item
const MediaListItem = React.memo(
	function MediaListItem({
		file,
		isFoldersTab,
		isCheckboxSelected,
		isSelected,
		onClick,
		onCheckboxToggle,
		subPath,
	}: {
		file: MediaFile;
		isFoldersTab: boolean;
		isCheckboxSelected: boolean;
		isSelected: boolean;
		onClick: (e: React.MouseEvent) => void;
		onCheckboxToggle: (e: React.MouseEvent) => void;
		subPath?: string | null;
	}) {
		const FileIcon = getFileIcon(file.mimeType);
		const [isLoaded, setIsLoaded] = React.useState(false);
		const [hasError, setHasError] = React.useState(false);
		const listImgRef = React.useRef<HTMLImageElement | null>(null);

		const imageSrc = file.images && (file.images.thumbnail || file.images.small || file.images.original);

		React.useEffect(() => {
			const img = listImgRef.current;
			if (!img) return;
			if (img.complete && img.naturalWidth > 0) {
				setIsLoaded(true);
			} else {
				setIsLoaded(false);
			}
		}, [imageSrc]);

		return (
			<div
				className={`relative group flex items-center space-x-3 rounded-lg cursor-pointer transition-all duration-200 ${
					isSelected ? "bg-primary/10 ring-2 ring-inset ring-primary shadow-md" : "hover:bg-muted/50 hover:shadow-sm"
				}`}
				onClick={onClick}
			>
				{/* Circle Checkbox for folders tab - hover to show */}
				{isFoldersTab && (
					<div
						data-checkbox
						className={`absolute right-3 z-10 transition-opacity ${
							isCheckboxSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
						}`}
						onClick={onCheckboxToggle}
					>
						<div className="w-6 h-6 rounded-md bg-white/95 dark:bg-gray-800/95 border-2 border-gray-400 dark:border-gray-500 shadow-lg backdrop-blur-sm flex items-center justify-center hover:scale-110 hover:border-primary transition-all">
							<Checkbox checked={!!isCheckboxSelected} className="border-0 w-4 h-4" />
						</div>
					</div>
				)}

				<div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
					{file.mimeType.startsWith("image/") && imageSrc ? (
						<>
							<Skeleton
								className={`pointer-events-none absolute inset-0 rounded-md transition-opacity ${
									isLoaded || hasError ? "opacity-0" : "opacity-100"
								}`}
								style={{ willChange: "opacity" }}
							/>
							{!hasError ? (
								<img
									ref={listImgRef}
									src={imageSrc}
									alt={file.originalName}
									loading="lazy"
									decoding="async"
									className="object-cover absolute inset-0 w-full h-full rounded-md"
									onLoad={() => setIsLoaded(true)}
									onError={() => setHasError(true)}
								/>
							) : (
								<div className="absolute inset-0 flex items-center justify-center bg-muted">
									<IconPhotoOff className="h-6 w-6 text-muted-foreground" />
								</div>
							)}
						</>
					) : file.mimeType.startsWith("video/") ? (
						<>
							{file.images?.thumbnail ? (
								<img
									src={file.images?.thumbnail}
									alt={file.originalName}
									loading="lazy"
									decoding="async"
									className="object-cover absolute inset-0 w-full h-full rounded-md"
								/>
							) : (
								<div className="absolute inset-0 flex items-center justify-center bg-muted">
									<IconVideo className="h-6 w-6 text-muted-foreground" />
								</div>
							)}
							{/* Video indicator icon */}
							<div className="absolute bottom-0.5 right-0.5 z-10 rounded bg-black/60 p-0.5">
								<IconVideo className="h-3 w-3 text-white" />
							</div>
							{file.hasClips && (
								<div className="absolute top-0.5 left-0.5 z-10" title="Has clips">
									<IconSparkles
										className="h-3 w-3 text-amber-400 drop-shadow-sm"
										fill="currentColor"
										strokeWidth={1.5}
									/>
								</div>
							)}
						</>
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<FileIcon className="h-6 w-6 text-muted-foreground" />
						</div>
					)}
				</div>

				<div className="flex-1 min-w-0">
					<div className="font-medium truncate flex items-center gap-2">
						<span className="truncate">{file.originalName}</span>
						{subPath ? (
							<span
								className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
								title={subPath}
							>
								{subPath}
							</span>
						) : null}
					</div>
					<div className="text-sm text-muted-foreground">
						{formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
					</div>
				</div>
			</div>
		);
	},
	(prev, next) => {
		return (
			prev.file.id === next.file.id &&
			prev.file.hasClips === next.file.hasClips &&
			prev.isFoldersTab === next.isFoldersTab &&
			prev.isCheckboxSelected === next.isCheckboxSelected &&
			prev.isSelected === next.isSelected
		);
	},
);

interface MediaViewGridProps {
	mediaType: "image" | "video" | "documents" | "all";
	fileTypes?: string[];
	selectionFilter?: "image" | "video" | "document" | "all";
}

export function MediaViewGrid({ mediaType, selectionFilter }: MediaViewGridProps) {
	// Select only needed slices to minimize re-renders
	const {
		activeTab,
		searchQuery,
		viewMode,
		selectedFiles,
		selectedItems,
		currentFolder,
		mediaRefreshToken,
		filesMoveToken,
		lastFilesMove,
		lastFileUpdate,
		fileUpdateToken,
		multiSelect,
		onMultiSelectCallback,
	} = useMediaLibraryStore(
		useShallow((s) => ({
			activeTab: s.activeTab,
			searchQuery: s.searchQuery,
			viewMode: s.viewMode,
			selectedFiles: s.selectedFiles,
			selectedItems: s.selectedItems,
			currentFolder: s.currentFolder,
			mediaRefreshToken: s.mediaRefreshToken,
			filesMoveToken: s.filesMoveToken,
			lastFilesMove: s.lastFilesMove,
			lastFileUpdate: s.lastFileUpdate,
			fileUpdateToken: s.fileUpdateToken,
			multiSelect: s.multiSelect,
			onMultiSelectCallback: s.onMultiSelectCallback,
		})),
	);

	const {
		selectFile,
		deselectFile,
		toggleItemSelection,
		setSidebarFile,
		setViewMode,
		setMultiSelect,
		setVisibleFiles,
	} = useMediaLibraryStore(
		useShallow((s) => ({
			selectFile: s.selectFile,
			deselectFile: s.deselectFile,
			toggleItemSelection: s.toggleItemSelection,
			setSidebarFile: s.setSidebarFile,
			setViewMode: s.setViewMode,
			setMultiSelect: s.setMultiSelect,
			setVisibleFiles: s.setVisibleFiles,
		})),
	);

	// Only subscribe to the id to minimize re-renders
	const sidebarFileId = useMediaLibraryStore((s) => s.sidebarFile?.id);

	// Check if this grid is for the active tab
	const isActiveTab = React.useMemo(() => {
		switch (mediaType) {
			case "image":
				return activeTab === "images";
			case "video":
				return activeTab === "videos";
			case "documents":
				return activeTab === "files";
			case "all":
				return activeTab === "folders";
			default:
				return true;
		}
	}, [mediaType, activeTab]);

	// Check if we're in folders tab (for bulk selection)
	const isFoldersTab = mediaType === "all";

	// When onMultiSelectCallback is active (external multi-select mode like Add Images),
	// we should use selectedFiles even in Folders tab, not the folder's own selectedItems
	const useFoldersBulkMode = isFoldersTab && !onMultiSelectCallback;

	// Drive multi-select strictly from active tab to avoid stale state between tabs
	// BUT don't override if we're in external multi-select mode (onMultiSelectCallback is set)
	React.useEffect(() => {
		if (!onMultiSelectCallback) {
			setMultiSelect(activeTab === "folders");
		}
	}, [activeTab, setMultiSelect, onMultiSelectCallback]);

	// Store raw (unfiltered) accumulated files separately from display files
	// This allows client-side selectionFilter to work without losing accumulated data
	const [rawFiles, setRawFiles] = React.useState<MediaFile[]>([]);
	const [page, setPage] = React.useState(1);
	const [totalCount, setTotalCount] = React.useState<number>(0);

	// Folders metadata (to compute relative subpaths in folders view)
	const { data: foldersResp } = useQuery({
		queryKey: ["media-folders"],
		queryFn: () => MediaService.getFolders(),
		staleTime: 60_000,
	});

	type FolderNode = { id: number; name: string; parentId?: number | null };
	const folderMap = React.useMemo(() => {
		const map = new Map<number, FolderNode>();
		for (const f of foldersResp?.data?.folders || []) {
			map.set(f.id, { id: f.id, name: f.name, parentId: f.parentId ?? null });
		}
		return map;
	}, [foldersResp?.data?.folders]);

	// Helper to check if a folder is in the subtree of root
	const isDescendant = React.useCallback(
		(rootId: number, childId: number | undefined | null): boolean => {
			if (!childId) return false;
			if (rootId === childId) return true;
			let cursor = folderMap.get(childId) || null;
			let hops = 0;
			while (cursor && hops < 200) {
				if (!cursor.parentId) return false;
				if (cursor.parentId === rootId) return true;
				cursor = folderMap.get(cursor.parentId) || null;
				hops++;
			}
			return false;
		},
		[folderMap],
	);

	const computeSubPath = React.useCallback(
		(fileFolderId?: number | null): string | null => {
			// Only in folders tab with a selected folder
			if (!isFoldersTab || !currentFolder?.id || !fileFolderId) return null;
			if (fileFolderId === currentFolder.id) return null; // directly in this folder
			// Walk up parents until currentFolder or root
			const names: string[] = [];
			let cursor = folderMap.get(fileFolderId);
			// Prevent infinite loops with a simple hop count limit
			let hops = 0;
			while (cursor && hops < 50) {
				if (cursor.id === currentFolder.id) break;
				names.unshift(cursor.name);
				if (!cursor.parentId) break;
				cursor = folderMap.get(cursor.parentId);
				hops++;
			}
			// If we didn't reach currentFolder, this file isn't under it; no badge
			if (!cursor || cursor.id !== currentFolder.id) return null;
			return names.join("/");
		},
		[isFoldersTab, currentFolder?.id, folderMap],
	);

	// Note: MIME type filtering is now handled by backend endpoints

	// Fetch media files using type-specific endpoints
	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["media-files", mediaType, searchQuery, currentFolder?.id, page, mediaRefreshToken],
		queryFn: () => {
			// For images, videos, and documents: don't send folderId
			// For 'all' (folders view): send folderId
			const baseParams = {
				search: searchQuery || undefined,
				page,
				limit: 20,
			};

			switch (mediaType) {
				case "image":
					return MediaService.getImages(baseParams);
				case "video":
					return MediaService.getVideos(baseParams);
				case "documents":
					return MediaService.getDocuments(baseParams);
				case "all":
					return MediaService.getFolderFiles({
						...baseParams,
						folderId: currentFolder?.id,
					});
				default:
					return MediaService.getImages(baseParams);
			}
		},
		enabled: isActiveTab, // Only fetch when tab is active
	});

	// Cache the pagination total from API - only update when it comes from API, never during loading
	React.useEffect(() => {
		if (data?.meta?.pagination?.total) {
			setTotalCount(data.meta.pagination.total);
		}
	}, [data?.meta?.pagination?.total]); // Note: File filtering is now handled by backend endpoints

	// Helper to dedupe by id while preserving order
	const mergeDedupById = React.useCallback((prev: MediaFile[], next: MediaFile[]) => {
		const seen = new Set<number>();
		const out: MediaFile[] = [];
		for (const f of prev) {
			if (!seen.has(f.id)) {
				seen.add(f.id);
				out.push(f);
			}
		}
		for (const f of next) {
			if (!seen.has(f.id)) {
				seen.add(f.id);
				out.push(f);
			}
		}
		return out;
	}, []);

	// Accumulate raw files for infinite scroll with de-duplication
	React.useEffect(() => {
		if (data?.data) {
			if (page === 1) {
				setRawFiles(mergeDedupById([], data.data));
			} else {
				setRawFiles((prev) => mergeDedupById(prev, data.data));
			}
		}
	}, [data, page, mergeDedupById]);

	// Derive display files from raw files + client-side selectionFilter
	const allFiles = React.useMemo(
		() => filterFilesBySelectionFilter(rawFiles, selectionFilter),
		[rawFiles, selectionFilter],
	);

	// Poll for video processing status updates (auto-refresh when processing completes)
	const queryKeyToInvalidate = React.useMemo(
		() => ["media-files", mediaType, searchQuery, currentFolder?.id, page, mediaRefreshToken],
		[mediaType, searchQuery, currentFolder?.id, page, mediaRefreshToken],
	);
	useProcessingVideosPolling(allFiles, queryKeyToInvalidate);

	// Update visible files in store for "Select All" functionality
	React.useEffect(() => {
		if (isFoldersTab) {
			setVisibleFiles(allFiles);
		}
	}, [allFiles, isFoldersTab, setVisibleFiles]);

	// Apply in-place updates when files are moved (without refetch)
	React.useEffect(() => {
		if (!isFoldersTab || !currentFolder?.id) return;
		if (!lastFilesMove || !lastFilesMove.ids?.length) return;
		const movedIds = new Set<number>(lastFilesMove.ids);
		const targetId = lastFilesMove.targetFolderId;
		const targetUnderCurrent = typeof targetId === "number" && isDescendant(currentFolder.id, targetId);

		setRawFiles((prev) => {
			if (!prev.length) return prev;
			let changed = false;
			let next = prev.map((f) => {
				if (!movedIds.has(f.id)) return f;
				changed = true;
				if (targetUnderCurrent) {
					// Move within subtree: update folderId so grouping adjusts (current vs subfolders)
					return { ...f, folderId: targetId } as MediaFile;
				}
				// Moved outside subtree: remove by marking with sentinel
				return { ...f, folderId: -999999 } as MediaFile;
			});
			if (!changed) return prev;
			// Filter out any sentinel-marked
			next = next.filter((f) => f.folderId !== -999999);
			return next;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filesMoveToken]);

	// Apply in-place updates when files are updated (without refetch)
	React.useEffect(() => {
		if (!lastFileUpdate) return;
		setRawFiles((prev) => {
			return prev.map((f) => {
				if (f.id === lastFileUpdate.id) {
					return lastFileUpdate;
				}
				return f;
			});
		});
	}, [fileUpdateToken, lastFileUpdate]);

	// Reset page when filters change (except selectionFilter which is client-side only)
	React.useEffect(() => {
		setPage(1);
		setRawFiles([]);
	}, [mediaType, searchQuery, currentFolder?.id, mediaRefreshToken]);

	// Infinite scroll via IntersectionObserver on native scroll container
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

	const sentinelRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		if (!isActiveTab) return;
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		// Find the native scroll container (div with data-media-scroll attribute)
		const scrollContainer = sentinel.closest("[data-media-scroll]") as HTMLElement | null;
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
				rootMargin: "0px 0px 400px 0px", // trigger 400px before sentinel is visible
			},
		);

		observer.observe(sentinel);

		return () => {
			observer.disconnect();
		};
	}, [isActiveTab, allFiles.length]); // Re-attach when tab changes or when new items render

	const handleFileClick = (file: MediaFile, event?: React.MouseEvent) => {
		// Read latest store state to avoid stale closures during rapid interactions
		const storeState = useMediaLibraryStore.getState();
		const isMultiSelectMode = storeState.multiSelect || !!storeState.onMultiSelectCallback;
		// Use folders bulk mode only when in folders tab AND no external multi-select callback
		const useFoldersBulkModeLocal = isFoldersTab && !storeState.onMultiSelectCallback;

		// In folders tab or multi-select mode, support multi-select
		if (isFoldersTab || isMultiSelectMode) {
			const hasSelections = storeState.selectedFiles.length > 0 || storeState.selectedItems.length > 0;

			// In external multi-select mode (has callback), always toggle selection on click using selectedFiles
			if (isMultiSelectMode && !useFoldersBulkModeLocal) {
				// Toggle file selection directly using store setState to ensure multi-select behavior
				const isSelected = storeState.selectedFiles.some((f) => f.id === file.id);
				if (isSelected) {
					// Remove from selection
					useMediaLibraryStore.setState({
						selectedFiles: storeState.selectedFiles.filter((f) => f.id !== file.id),
					});
				} else {
					// Add to selection (multi-select: append to array)
					useMediaLibraryStore.setState({
						selectedFiles: [...storeState.selectedFiles, file],
					});
				}
				setSidebarFile(file);
				return;
			}

			// If in selection mode or checkbox/ctrl+click, handle selection
			if (
				event?.ctrlKey ||
				event?.metaKey ||
				(event?.target as HTMLElement)?.closest("[data-checkbox]") ||
				hasSelections
			) {
				// Toggle this file's selection
				toggleItemSelection({
					id: file.id,
					type: "file",
					data: file,
				});
				// Close sidebar in selection mode
				setSidebarFile(null);
			} else {
				// No selections - normal mode: open sidebar
				setSidebarFile(file);
			}
		} else {
			// In other tabs without multi-select, use the old selection logic
			const isSelected = selectedFiles.some((f) => f.id === file.id);

			if (isSelected) {
				deselectFile(file.id);
				setSidebarFile(null);
			} else {
				selectFile(file);
				setSidebarFile(file);
			}
		}
	};

	// helpers moved to top-level for reuse

	if (isLoading && page === 1) {
		return (
			<div className="space-y-4">
				<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
					{[...Array(20)].map((_, i) => (
						<div key={i} className="rounded-lg">
							<Skeleton className="aspect-square rounded-md" />
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

	// Sort and group files: current folder first, then subfolder files
	// Sort is done before grouping to ensure current folder files render first
	const { currentFolderFiles, subfolderFiles } = (() => {
		// Sort: current folder files first (folderId === currentFolder.id), then others
		const sorted = [...allFiles].sort((a, b) => {
			if (!isFoldersTab || !currentFolder?.id) return 0;
			const aIsCurrent = a.folderId === currentFolder.id ? 0 : 1;
			const bIsCurrent = b.folderId === currentFolder.id ? 0 : 1;
			return aIsCurrent - bIsCurrent;
		});

		// Group files: current folder first, then subfolder files
		if (!isFoldersTab || !currentFolder?.id) {
			return { currentFolderFiles: sorted, subfolderFiles: [] };
		}
		const current: MediaFile[] = [];
		const subfolder: MediaFile[] = [];
		for (const f of sorted) {
			if (f.folderId === currentFolder.id) {
				current.push(f);
			} else {
				subfolder.push(f);
			}
		}
		return { currentFolderFiles: current, subfolderFiles: subfolder };
	})();

	// Label helper for headers and empty states
	const pluralLabel = (() => {
		switch (mediaType) {
			case "image":
				return "images";
			case "video":
				return "videos";
			case "documents":
				return "documents";
			case "all":
			default:
				return "items";
		}
	})();

	return (
		<div className="flex flex-col h-full" data-cid="MediaViewGrid">
			{/* Header - fixed above scroll */}
			{mediaType !== "all" && (
				<div className="flex items-center justify-between pb-4 shrink-0 bg-background">
					<div>
						<h2 className="text-lg font-semibold capitalize">All {pluralLabel}</h2>
						<div className="text-sm text-muted-foreground">
							{totalCount} {pluralLabel}
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
			)}

			{/* Scrollable Content */}
			<div className="flex-1 overflow-y-auto" data-media-scroll>
				{/* Content */}
				{allFiles.length === 0 && !isLoading ? (
					<div className="text-center py-12">
						<div className="text-muted-foreground">
							No {pluralLabel} found
							{searchQuery && ` for "${searchQuery}"`}
						</div>
					</div>
				) : viewMode === "grid" ? (
					<div className="space-y-6">
						{/* Current folder files */}
						{currentFolderFiles.length > 0 && (
							<div className="space-y-3">
								<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
									{currentFolderFiles.map((file) => {
										const showCheckbox = isFoldersTab || multiSelect;
										const isCheckboxSelected = useFoldersBulkMode
											? selectedItems.some((item) => item.id === file.id && item.type === "file")
											: selectedFiles.some((f) => f.id === file.id);
										const isSelected = useFoldersBulkMode
											? isCheckboxSelected || sidebarFileId === file.id
											: selectedFiles.some((f) => f.id === file.id);

										return (
											<MediaGridItem
												key={`grid-${file.id}`}
												file={file}
												isFoldersTab={showCheckbox}
												isCheckboxSelected={!!isCheckboxSelected}
												isSelected={!!isSelected}
												onClick={(e) => handleFileClick(file, e)}
												onCheckboxToggle={(e) => {
													e.stopPropagation();
													if (useFoldersBulkMode) {
														toggleItemSelection({
															id: file.id,
															type: "file",
															data: file,
														});
														setSidebarFile(null);
													} else {
														// For multi-select in other tabs or external multi-select mode - directly update store
														const storeState = useMediaLibraryStore.getState();
														const isCurrentlySelected = storeState.selectedFiles.some((f) => f.id === file.id);
														if (isCurrentlySelected) {
															useMediaLibraryStore.setState({
																selectedFiles: storeState.selectedFiles.filter((f) => f.id !== file.id),
															});
														} else {
															useMediaLibraryStore.setState({
																selectedFiles: [...storeState.selectedFiles, file],
															});
														}
													}
												}}
												subPath={computeSubPath(file.folderId)}
											/>
										);
									})}
								</div>
							</div>
						)}

						{/* Subfolder files */}
						{subfolderFiles.length > 0 && (
							<div className="space-y-3">
								<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 border-t pt-2">
									From Subfolders
								</div>
								<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
									{subfolderFiles.map((file) => {
										const showCheckbox = isFoldersTab || multiSelect;
										const isCheckboxSelected = useFoldersBulkMode
											? selectedItems.some((item) => item.id === file.id && item.type === "file")
											: selectedFiles.some((f) => f.id === file.id);
										const isSelected = useFoldersBulkMode
											? isCheckboxSelected || sidebarFileId === file.id
											: selectedFiles.some((f) => f.id === file.id);

										const subPath = computeSubPath(file.folderId);

										return (
											<MediaGridItem
												key={`grid-${file.id}`}
												file={file}
												isFoldersTab={showCheckbox}
												isCheckboxSelected={!!isCheckboxSelected}
												isSelected={!!isSelected}
												onClick={(e) => handleFileClick(file, e)}
												onCheckboxToggle={(e) => {
													e.stopPropagation();
													if (useFoldersBulkMode) {
														toggleItemSelection({
															id: file.id,
															type: "file",
															data: file,
														});
														setSidebarFile(null);
													} else {
														const storeState = useMediaLibraryStore.getState();
														const isCurrentlySelected = storeState.selectedFiles.some((f) => f.id === file.id);
														if (isCurrentlySelected) {
															useMediaLibraryStore.setState({
																selectedFiles: storeState.selectedFiles.filter((f) => f.id !== file.id),
															});
														} else {
															useMediaLibraryStore.setState({
																selectedFiles: [...storeState.selectedFiles, file],
															});
														}
													}
												}}
												subPath={subPath}
											/>
										);
									})}
								</div>
							</div>
						)}
					</div>
				) : (
					<div className="space-y-6">
						{/* Current folder files */}
						{currentFolderFiles.length > 0 && (
							<div className="space-y-2">
								<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
									{currentFolder?.name}
								</div>
								<div className="space-y-2">
									{currentFolderFiles.map((file) => {
										const showCheckbox = isFoldersTab || multiSelect;
										const isCheckboxSelected = useFoldersBulkMode
											? selectedItems.some((item) => item.id === file.id && item.type === "file")
											: selectedFiles.some((f) => f.id === file.id);
										const isSelected = useFoldersBulkMode
											? isCheckboxSelected || sidebarFileId === file.id
											: selectedFiles.some((f) => f.id === file.id);

										return (
											<MediaListItem
												key={`list-${file.id}`}
												file={file}
												isFoldersTab={showCheckbox}
												isCheckboxSelected={!!isCheckboxSelected}
												isSelected={!!isSelected}
												onClick={(e) => handleFileClick(file, e)}
												onCheckboxToggle={(e) => {
													e.stopPropagation();
													if (useFoldersBulkMode) {
														toggleItemSelection({
															id: file.id,
															type: "file",
															data: file,
														});
														setSidebarFile(null);
													} else {
														const storeState = useMediaLibraryStore.getState();
														const isCurrentlySelected = storeState.selectedFiles.some((f) => f.id === file.id);
														if (isCurrentlySelected) {
															useMediaLibraryStore.setState({
																selectedFiles: storeState.selectedFiles.filter((f) => f.id !== file.id),
															});
														} else {
															useMediaLibraryStore.setState({
																selectedFiles: [...storeState.selectedFiles, file],
															});
														}
													}
												}}
												subPath={computeSubPath(file.folderId)}
											/>
										);
									})}
								</div>
							</div>
						)}

						{/* Separator */}
						{currentFolderFiles.length > 0 && subfolderFiles.length > 0 && <div className="h-px bg-border" />}

						{/* Subfolder files */}
						{subfolderFiles.length > 0 && (
							<div className="space-y-2">
								<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
									From Subfolders
								</div>
								<div className="space-y-2">
									{subfolderFiles.map((file) => {
										const showCheckbox = isFoldersTab || multiSelect;
										const isCheckboxSelected = useFoldersBulkMode
											? selectedItems.some((item) => item.id === file.id && item.type === "file")
											: selectedFiles.some((f) => f.id === file.id);
										const isSelected = useFoldersBulkMode
											? isCheckboxSelected || sidebarFileId === file.id
											: selectedFiles.some((f) => f.id === file.id);

										const subPath = computeSubPath(file.folderId);

										return (
											<MediaListItem
												key={`list-${file.id}`}
												file={file}
												isFoldersTab={showCheckbox}
												isCheckboxSelected={!!isCheckboxSelected}
												isSelected={!!isSelected}
												onClick={(e) => handleFileClick(file, e)}
												onCheckboxToggle={(e) => {
													e.stopPropagation();
													if (useFoldersBulkMode) {
														toggleItemSelection({
															id: file.id,
															type: "file",
															data: file,
														});
														setSidebarFile(null);
													} else {
														const storeState = useMediaLibraryStore.getState();
														const isCurrentlySelected = storeState.selectedFiles.some((f) => f.id === file.id);
														if (isCurrentlySelected) {
															useMediaLibraryStore.setState({
																selectedFiles: storeState.selectedFiles.filter((f) => f.id !== file.id),
															});
														} else {
															useMediaLibraryStore.setState({
																selectedFiles: [...storeState.selectedFiles, file],
															});
														}
													}
												}}
												subPath={subPath}
											/>
										);
									})}
								</div>
							</div>
						)}
					</div>
				)}

				{/* Load More Trigger */}
				<div ref={sentinelRef} className="h-10 w-full">
					{isFetching && page > 1 && (
						<div className="text-center py-2">
							<div className="text-sm text-muted-foreground">Loading more...</div>
						</div>
					)}
				</div>
			</div>
			{/* end scroll wrapper */}
		</div>
	);
}
