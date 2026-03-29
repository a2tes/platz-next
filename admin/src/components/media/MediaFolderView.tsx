"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	IconFolder,
	IconFolderOpen,
	IconChevronRight,
	IconChevronDown,
	IconPlus,
	IconEdit,
	IconTrash,
	IconDotsVertical,
	IconGrid3x3,
	IconList,
	IconFolderDown,
	IconTrashX,
	IconRestore,
	IconFilter,
	IconPhoto,
	IconVideo,
	IconFile,
	IconFiles,
	IconFileArrowRight,
	IconFolderSymlink,
	IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { useUploadStore, startUploadProcessing } from "@/stores/uploadStore";
import { MediaService } from "@/services/mediaService";
import { MediaFolder } from "@/types/media";
import { MediaViewGrid } from "./MediaViewGrid";
import { MediaMoveItemsModal } from "./MediaMoveItemsModal";
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

export function FolderView() {
	const queryClient = useQueryClient();
	const {
		currentFolder,
		expandedFolders,
		sidebarFile,
		selectedItems,
		viewMode,
		selectionFilter,
		isTrashView,
		visibleFiles,
		onMultiSelectCallback,
		setCurrentFolder,
		toggleFolderExpanded,
		toggleItemSelection,
		clearSelection,
		setViewMode,
		setTrashView,
		setSelectionFilter,
		selectAllVisibleFiles,
	} = useMediaLibraryStore();

	// Global upload store
	const { uploadingFiles, addFiles: addFilesToUploadQueue } = useUploadStore();

	// Local state for folder management
	const [showCreateDialog, setShowCreateDialog] = React.useState(false);
	const [showRenameDialog, setShowRenameDialog] = React.useState(false);
	const [selectedFolder, setSelectedFolder] = React.useState<MediaFolder | null>(null);
	const [newFolderName, setNewFolderName] = React.useState("");
	const [parentFolder, setParentFolder] = React.useState<MediaFolder | null>(null);

	// Bulk actions state
	const [showMoveModal, setShowMoveModal] = React.useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
	const [showPurgeDialog, setShowPurgeDialog] = React.useState(false);
	const [singlePurgeFileId, setSinglePurgeFileId] = React.useState<number | null>(null);

	// Trash pagination state
	const [trashPage, setTrashPage] = React.useState(1);
	const [allTrashedFiles, setAllTrashedFiles] = React.useState<any[]>([]);

	// Fetch folders
	const { data: folders, isLoading } = useQuery({
		queryKey: ["media-folders"],
		queryFn: () => MediaService.getFolders(),
	});

	// Fetch trashed files with pagination
	const {
		data: trashedFilesData,
		isLoading: isLoadingTrash,
		isFetching: isFetchingTrash,
	} = useQuery({
		queryKey: ["trashed-files", trashPage],
		queryFn: () => MediaService.getTrashedFiles({ page: trashPage, limit: 24 }),
		enabled: isTrashView,
	});

	// Accumulate trashed files for infinite scroll
	React.useEffect(() => {
		if (trashedFilesData?.data) {
			if (trashPage === 1) {
				setAllTrashedFiles(trashedFilesData.data);
			} else {
				setAllTrashedFiles((prev) => {
					const existingIds = new Set(prev.map((f) => f.id));
					const newFiles = trashedFilesData.data.filter((f: any) => !existingIds.has(f.id));
					return [...prev, ...newFiles];
				});
			}
		}
	}, [trashedFilesData, trashPage]);

	// Reset trash pagination when entering/leaving trash view
	React.useEffect(() => {
		if (isTrashView) {
			setTrashPage(1);
			setAllTrashedFiles([]);
		}
	}, [isTrashView]);

	// Infinite scroll for trash
	const trashLoadMoreRef = React.useRef<HTMLDivElement>(null);

	// Store pagination info in ref to avoid re-creating observer
	const trashPaginationRef = React.useRef<{ page: number; totalPages: number }>({ page: 1, totalPages: 1 });

	React.useEffect(() => {
		if (trashedFilesData?.meta?.pagination) {
			trashPaginationRef.current = {
				page: trashedFilesData.meta.pagination.page,
				totalPages: trashedFilesData.meta.pagination.totalPages,
			};
		}
	}, [trashedFilesData]);

	React.useEffect(() => {
		if (!isTrashView) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const { page, totalPages } = trashPaginationRef.current;
				if (entries[0].isIntersecting && page < totalPages && !isFetchingTrash) {
					setTrashPage((prev) => prev + 1);
				}
			},
			{ threshold: 0.1, rootMargin: "100px" },
		);

		if (trashLoadMoreRef.current) {
			observer.observe(trashLoadMoreRef.current);
		}

		return () => observer.disconnect();
	}, [isTrashView, isFetchingTrash]);

	// Start upload processing when files are added
	React.useEffect(() => {
		const hasPending = uploadingFiles.some((f) => f.status === "pending");
		if (hasPending) {
			startUploadProcessing(queryClient);
		}
	}, [uploadingFiles, queryClient]);

	// Extract folder list and trash count from API response
	const folderList = folders?.data?.folders ?? [];
	const trashCount = folders?.data?.trashCount ?? 0;

	// Derive current folder details from folders list (for counts)
	const currentFolderDetails = React.useMemo(() => {
		if (!folderList.length || !currentFolder?.id) return null;
		return folderList.find((f) => f.id === currentFolder.id) || null;
	}, [folderList, currentFolder?.id]);

	// Mutations
	const createFolderMutation = useMutation({
		mutationFn: (data: { name: string; parentId?: number }) => MediaService.createFolder(data.name, data.parentId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			setShowCreateDialog(false);
			setNewFolderName("");
			setParentFolder(null);
		},
	});

	const renameFolderMutation = useMutation({
		mutationFn: (data: { id: number; name: string }) => MediaService.renameFolder(data.id, data.name),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			setShowRenameDialog(false);
			setSelectedFolder(null);
			setNewFolderName("");
		},
	});

	const deleteFolderMutation = useMutation({
		mutationFn: (id: number) => MediaService.deleteFolder(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			// If deleted folder was selected, go to root
			if (selectedFolder && currentFolder?.id === selectedFolder.id) {
				setCurrentFolder(null);
			}
		},
	});

	// Restore file mutation
	const restoreFileMutation = useMutation({
		mutationFn: (id: number) => MediaService.restoreFile(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
			queryClient.invalidateQueries({ queryKey: ["media-files"] });
			queryClient.invalidateQueries({ queryKey: ["folder-files"] });
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			clearSelection();
			toast.success("File restored successfully");
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to restore file";
			toast.error(message);
		},
	});

	// Purge file mutation (permanently delete from S3 and database)
	const purgeFileMutation = useMutation({
		mutationFn: (id: number) => MediaService.purgeFile(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			clearSelection();
			setSinglePurgeFileId(null);
			toast.success("File permanently deleted");
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to delete file";
			toast.error(message);
		},
	});

	// Bulk restore mutation (uses bulk API endpoint)
	const bulkRestoreMutation = useMutation({
		mutationFn: (fileIds: number[]) => MediaService.bulkRestoreFiles(fileIds),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
			queryClient.invalidateQueries({ queryKey: ["media-files"] });
			queryClient.invalidateQueries({ queryKey: ["folder-files"] });
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			clearSelection();
			if (data.restored.length > 0) {
				toast.success(`Restored ${data.restored.length} file${data.restored.length > 1 ? "s" : ""}`);
			}
			if (data.failed.length > 0) {
				toast.error(`Failed to restore ${data.failed.length} file${data.failed.length > 1 ? "s" : ""}`);
			}
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to restore files";
			toast.error(message);
		},
	});

	// Bulk purge mutation (uses bulk API endpoint)
	const bulkPurgeMutation = useMutation({
		mutationFn: (fileIds: number[]) => MediaService.bulkPurgeFiles(fileIds),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["trashed-files"] });
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			clearSelection();
			setShowPurgeDialog(false);
			if (data.purged.length > 0) {
				toast.success(`Permanently deleted ${data.purged.length} file${data.purged.length > 1 ? "s" : ""}`);
			}
			if (data.failed.length > 0) {
				toast.error(`Failed to delete ${data.failed.length} file${data.failed.length > 1 ? "s" : ""}`);
			}
		},
	});

	// Drag & Drop state
	const [isDragging, setIsDragging] = React.useState(false);
	const dragCounter = React.useRef(0);

	// Mobile destination picker (folders tab)
	const [mobileDestOpen, setMobileDestOpen] = React.useState(false);

	// Drag & Drop handlers
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	};

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current += 1;
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current -= 1;
		if (dragCounter.current <= 0) {
			setIsDragging(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current = 0;
		setIsDragging(false);

		const dt = e.dataTransfer;
		const files: File[] = [];
		if (dt.items && dt.items.length) {
			for (let i = 0; i < dt.items.length; i++) {
				const item = dt.items[i];
				if (item.kind === "file") {
					const file = item.getAsFile();
					if (file) files.push(file);
				}
			}
		} else if (dt.files && dt.files.length) {
			for (let i = 0; i < dt.files.length; i++) {
				files.push(dt.files[i]);
			}
		}

		if (files.length === 0) return;
		addFilesToUploadQueue(files, currentFolder?.id, currentFolder?.name);
	};

	// Bulk actions mutations
	const bulkDeleteMutation = useMutation({
		mutationFn: (items: { fileIds: number[]; folderIds: number[] }) => MediaService.bulkDeleteItems(items),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });
			queryClient.invalidateQueries({ queryKey: ["media-files"] });
			queryClient.invalidateQueries({ queryKey: ["folder-files"] });
			// Force MediaViewGrid to reset pagination and refetch
			useMediaLibraryStore.getState().bumpMediaRefreshToken();
			clearSelection();
			setShowDeleteDialog(false);

			// Show detailed notifications
			const totalDeleted = data.deletedFiles.length + data.deletedFolders.length;

			// Build success message
			if (totalDeleted > 0) {
				const messages: string[] = [];
				if (data.deletedFiles.length > 0) {
					messages.push(`${data.deletedFiles.length} file${data.deletedFiles.length > 1 ? "s" : ""}`);
				}
				if (data.deletedFolders.length > 0) {
					messages.push(`${data.deletedFolders.length} folder${data.deletedFolders.length > 1 ? "s" : ""}`);
				}
				toast.success(`Deleted ${messages.join(" and ")}`, {
					duration: 5000,
				});
			}

			// Build and show failures if any
			if (data.failed && data.failed.length > 0) {
				// Group errors by error message to avoid duplicates
				const errorGroups: { [key: string]: number } = {};
				data.failed.forEach((failed) => {
					const error = failed.error || "Unknown error";
					errorGroups[error] = (errorGroups[error] || 0) + 1;
				});

				// Show error notification after a small delay to prevent overlap
				// This ensures both notifications are readable
				setTimeout(
					() => {
						toast.error(
							<div className="space-y-1">
								<div className="font-semibold">
									{totalDeleted > 0
										? `Failed to delete ${data.failed.length} item${data.failed.length > 1 ? "s" : ""}:`
										: `Unable to delete ${data.failed.length} item${data.failed.length > 1 ? "s" : ""}:`}
								</div>
								<div className="text-sm space-y-0.5">
									{Object.entries(errorGroups).map(([error, count]) => (
										<div key={error}>
											{count > 1 ? `${count} items` : "1 item"}: {error}
										</div>
									))}
								</div>
							</div>,
							{
								duration: 7000,
							},
						);
					},
					totalDeleted > 0 ? 1500 : 0,
				); // Add delay if there's a success message
			}
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
					axiosError.response?.data?.error?.message || axiosError.response?.data?.message || "Failed to delete items";
				toast.error(message);
			} else if (error instanceof Error) {
				toast.error(error.message || "Failed to delete items");
			} else {
				toast.error("Failed to delete items");
			}
		},
	});

	const bulkMoveMutation = useMutation({
		mutationFn: (params: { fileIds: number[]; folderIds: number[]; targetFolderId?: number }) =>
			MediaService.bulkMoveItems(params),
		onSuccess: (data, variables) => {
			// Always refresh folder tree counts
			queryClient.invalidateQueries({ queryKey: ["media-folders"] });

			// Notify grids to update moved files in-place (no full reload)
			useMediaLibraryStore.getState().notifyFilesMoved(data.movedFiles || [], variables?.targetFolderId);

			clearSelection();
			setShowMoveModal(false);
			toast.success(`Moved ${data.movedFiles.length + data.movedFolders.length} items`);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to move items");
		},
	});

	const handleFolderClick = (folder: MediaFolder) => {
		setTrashView(false);
		setCurrentFolder(folder);
	};

	const handleFolderToggle = (folderId: number, e: React.MouseEvent) => {
		e.stopPropagation();
		toggleFolderExpanded(folderId);
	};

	const handleCreateFolder = () => {
		setParentFolder(currentFolder);
		setNewFolderName("");
		setShowCreateDialog(true);
	};

	const handleCreateSubfolder = (folder: MediaFolder) => {
		setParentFolder(folder);
		setNewFolderName("");
		setShowCreateDialog(true);
	};

	const handleRenameFolder = (folder: MediaFolder) => {
		setSelectedFolder(folder);
		setNewFolderName(folder.name);
		setShowRenameDialog(true);
	};

	const handleDeleteFolder = (folder: MediaFolder) => {
		if (
			confirm(`Are you sure you want to delete "${folder.name}" folder? This will also delete all files inside it.`)
		) {
			setSelectedFolder(folder);
			deleteFolderMutation.mutate(folder.id);
		}
	};

	const handleCreateSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (newFolderName.trim()) {
			createFolderMutation.mutate({
				name: newFolderName.trim(),
				parentId: parentFolder?.id,
			});
		}
	};

	const handleRenameSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (selectedFolder && newFolderName.trim()) {
			renameFolderMutation.mutate({
				id: selectedFolder.id,
				name: newFolderName.trim(),
			});
		}
	};

	// Bulk actions handlers
	const handleConfirmDelete = () => {
		const fileIds = selectedItems.filter((item) => item.type === "file").map((item) => item.id);
		const folderIds = selectedItems.filter((item) => item.type === "folder").map((item) => item.id);

		bulkDeleteMutation.mutate({ fileIds, folderIds });
	};

	const handleMoveItems = (targetFolderId?: number) => {
		const fileIds = selectedItems.filter((item) => item.type === "file").map((item) => item.id);
		const folderIds = selectedItems.filter((item) => item.type === "folder").map((item) => item.id);

		bulkMoveMutation.mutate({ fileIds, folderIds, targetFolderId });
	};

	// Build folder tree from flat array
	const buildFolderTree = (folders: MediaFolder[], parentId: number | null = null): MediaFolder[] => {
		const filtered = folders
			.filter((f) => {
				if (parentId === null) {
					// For root level, include folders with null or undefined parentId
					return !f.parentId || f.parentId === null;
				}
				return f.parentId === parentId;
			})
			.map((folder) => ({
				...folder,
				children: buildFolderTree(folders, folder.id),
			}));

		// Sort with Uncategorized first at root level
		if (parentId === null) {
			const uncategorized = filtered.find((f) => f.name === "Uncategorized");
			const others = filtered.filter((f) => f.name !== "Uncategorized").sort((a, b) => a.name.localeCompare(b.name));
			return uncategorized ? [uncategorized, ...others] : others;
		}

		return filtered.sort((a, b) => a.name.localeCompare(b.name));
	};

	// Simplified folder renderer for the mobile destination picker
	const renderPickerFolder = (folder: MediaFolder, level = 0) => {
		const hasChildren = folder.children && folder.children.length > 0;
		const isExpanded = expandedFolders.includes(folder.id);
		const isSelected = currentFolder?.id === folder.id;
		const isUncategorized = folder.name === "Uncategorized" && !folder.parentId;

		return (
			<div key={`picker-${folder.id}-${level}`}>
				<div
					className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent ${
						isSelected ? "bg-accent" : ""
					}`}
					style={{ paddingLeft: `${level * 1 + 8}px` }}
				>
					{hasChildren ? (
						<Button
							variant="ghost"
							size="icon"
							className="mx-0 h-4 w-4 p-0"
							onClick={(e) => {
								e.stopPropagation();
								handleFolderToggle(folder.id, e as unknown as React.MouseEvent);
							}}
						>
							{isExpanded ? <IconChevronDown className="h-3 w-3" /> : <IconChevronRight className="h-3 w-3" />}
						</Button>
					) : (
						<div className="w-4" />
					)}
					<div
						className="flex flex-1 items-center gap-2"
						onClick={() => {
							setCurrentFolder(!isUncategorized ? folder : null);
							setMobileDestOpen(false);
						}}
					>
						{isExpanded ? <IconFolderOpen className="h-4 w-4" /> : <IconFolder className="h-4 w-4" />}
						<span className="flex-1">{folder.name}</span>
						{folder.totalFileCount !== undefined && folder.totalFileCount > 0 && (
							<span className="text-xs text-muted-foreground">
								{folder.totalFileCount} file
								{folder.totalFileCount !== 1 ? "s" : ""}
							</span>
						)}
					</div>
				</div>
				{hasChildren && isExpanded && folder.children && (
					<div>{folder.children.map((child) => renderPickerFolder(child, level + 1))}</div>
				)}
			</div>
		);
	};

	const renderFolderTree = (folders: MediaFolder[], level = 0) => {
		return folders.map((folder) => {
			const isExpanded = expandedFolders.includes(folder.id);
			const isSelected = currentFolder?.id === folder.id;
			const isFolderSelected = selectedItems.some((item) => item.id === folder.id && item.type === "folder");
			const hasChildren = folder.children && folder.children.length > 0;
			const isUncategorized = folder.name === "Uncategorized" && !folder.parentId;

			return (
				<div key={folder.id}>
					<div
						className={`group flex items-center justify-between p-2 rounded cursor-pointer hover:bg-muted/50 ${
							isSelected ? "bg-primary/10 text-primary" : ""
						} ${isFolderSelected ? "bg-accent" : ""}`}
						style={{ paddingLeft: `${level * 16 + 8}px` }}
					>
						{/* Checkbox for folder selection - disabled for Uncategorized */}
						<div
							className="flex items-center space-x-2"
							onClick={(e) => {
								if (isUncategorized) return;
								e.stopPropagation();
								toggleItemSelection({
									id: folder.id,
									type: "folder",
									data: folder,
								});
							}}
						>
							<Checkbox checked={isFolderSelected} disabled={isUncategorized} />
						</div>

						<div
							className="flex items-center space-x-2 flex-1 pl-2"
							onClick={(e) => {
								handleFolderClick(folder);
								if (hasChildren) handleFolderToggle(folder.id, e);
							}}
						>
							{isExpanded ? (
								<IconFolderOpen className="h-4 w-4" />
							) : hasChildren ? (
								<IconFolderDown className="h-4 w-4" />
							) : (
								<IconFolder className="h-4 w-4" />
							)}

							<span className="text-sm font-medium">
								{folder.name}
								{folder.totalFileCount !== undefined && folder.totalFileCount > 0 && (
									<span className="text-xs text-muted-foreground ml-2">({folder.totalFileCount})</span>
								)}
							</span>
						</div>

						{/* Folder Actions - hide for Uncategorized */}
						{!isUncategorized && (
							<div className="opacity-0 group-hover:opacity-100 transition-opacity">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
											<IconDotsVertical className="h-3 w-3" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => handleCreateSubfolder(folder)}>
											<IconPlus className="mr-2 h-4 w-4" />
											New Subfolder
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleRenameFolder(folder)}>
											<IconEdit className="mr-2 h-4 w-4" />
											Rename
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleDeleteFolder(folder)} className="text-destructive">
											<IconTrash className="mr-2 h-4 w-4" />
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						)}
					</div>

					{hasChildren && isExpanded && folder.children && <div>{renderFolderTree(folder.children, level + 1)}</div>}
				</div>
			);
		});
	};

	if (isLoading) {
		return (
			<div className="flex h-full">
				<div className="w-80 border-r p-4 space-y-2">
					{[...Array(5)].map((_, i) => (
						<Skeleton key={i} className="h-8 w-full" />
					))}
				</div>
				<div className="flex-1 p-6">
					<Skeleton className="h-8 w-32 mb-4" />
					<div className="grid grid-cols-4 gap-4">
						{[...Array(8)].map((_, i) => (
							<Skeleton key={i} className="aspect-square" />
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col lg:flex-row h-full" data-cid="MediaFolderView">
			{/* Folder Tree Sidebar */}
			<div
				className={`hidden lg:flex lg:w-80 border-r bg-muted/20 transform transition-transform duration-300 ease-in-out flex-col h-full overflow-hidden ${
					sidebarFile ? "-translate-x-full w-0" : "translate-x-0"
				}`}
			>
				<div className="p-4 border-b">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold">Folders</h3>
						<Button size="sm" variant="outline" onClick={handleCreateFolder}>
							<IconPlus className="h-4 w-4 mr-1" />
							New
						</Button>
					</div>
				</div>

				<ScrollArea className="p-2 flex-1 min-h-0">
					{/* Root folder */}
					<div
						className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
							!currentFolder && !isTrashView ? "bg-primary/10 text-primary" : ""
						}`}
						onClick={() => {
							setTrashView(false);
							setCurrentFolder(null);
						}}
					>
						<IconFolder className="h-4 w-4" />
						<span className="text-sm font-medium">All Files</span>
					</div>

					{/* Folder tree */}
					{folderList.length > 0 && renderFolderTree(buildFolderTree(folderList))}

					{/* Trash folder */}
					{trashCount > 0 && (
						<>
							{/* Separator */}
							<div className="my-2 border-t" />
							<div
								className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
									isTrashView ? "bg-primary/10 text-primary" : ""
								}`}
								onClick={() => setTrashView(true)}
							>
								<IconTrash className="h-4 w-4" />
								<span className="text-sm font-medium">
									Trash
									<span className="text-xs text-muted-foreground ml-2">({trashCount})</span>
								</span>
							</div>
						</>
					)}
				</ScrollArea>

				{/* Folder Bulk Actions - fixed at bottom of sidebar */}
				{selectedItems.some((item) => item.type === "folder") && (
					<div className="border-t p-3 bg-muted/30 mt-auto">
						<div className="flex gap-2 justify-center items-center">
							<div className="text-xs text-muted-foreground flex-1">
								{selectedItems.filter((item) => item.type === "folder").length} folder
								{selectedItems.filter((item) => item.type === "folder").length !== 1 && "s"} selected
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const folderIds = selectedItems.filter((item) => item.type === "folder").map((item) => item.id);
									if (folderIds.length > 0) {
										setShowMoveModal(true);
									}
								}}
							>
								<IconFolderOpen className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const folderIds = selectedItems.filter((item) => item.type === "folder").map((item) => item.id);
									if (folderIds.length > 0) {
										setShowDeleteDialog(true);
									}
								}}
								className="text-destructive hover:text-destructive"
							>
								<IconTrash className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Content Area */}
			<div
				className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
					sidebarFile ? "-ml-80" : "ml-0"
				}`}
			>
				<div
					className="px-4 pt-4 flex-1 relative flex flex-col overflow-hidden"
					onDragOver={!isTrashView ? handleDragOver : undefined}
					onDragEnter={!isTrashView ? handleDragEnter : undefined}
					onDragLeave={!isTrashView ? handleDragLeave : undefined}
					onDrop={!isTrashView ? handleDrop : undefined}
				>
					<div className="pb-4 flex flex-col-reverse gap-4 md:flex-row justify-between items-center bg-background z-10 shrink-0">
						<div className="w-full md:w-auto">
							<h2 className="text-lg font-semibold">
								{isTrashView ? "Trash" : currentFolder ? currentFolder.name : "All Files"}
							</h2>
							<p className="text-sm text-muted-foreground">
								{isTrashView
									? `${trashedFilesData?.meta?.pagination?.total ?? allTrashedFiles.length} deleted files`
									: currentFolder
										? `${currentFolderDetails?.totalFileCount ?? currentFolderDetails?.fileCount ?? 0} files`
										: "All files in your media library"}
							</p>
						</div>
						{/* Filter and View Buttons */}
						<div className="w-full md:w-auto flex items-center gap-2">
							{/* Upload Button */}
							{!isTrashView && (
								<>
									{/* Mobile compact destination selector - hide in trash view */}
									{!isTrashView && (
										<div className="lg:hidden w-full">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setMobileDestOpen(true)}
												className="w-full justify-baseline"
											>
												<IconFolder className="h-4 w-4 mr-1" />
												<span className="truncate">{currentFolder ? currentFolder.name : "All Files"}</span>
											</Button>
											<Dialog open={mobileDestOpen} onOpenChange={setMobileDestOpen}>
												<DialogContent className="w-[90vw] max-w-md max-h-[80vh] p-0">
													<DialogHeader className="px-4 py-3 border-b">
														<DialogTitle>Select Folder</DialogTitle>
													</DialogHeader>
													<ScrollArea className="max-h-[60vh] p-2">
														{/* All Files option */}
														<div
															className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent ${
																!currentFolder ? "bg-accent" : ""
															}`}
															onClick={() => {
																setCurrentFolder(null);
																setMobileDestOpen(false);
															}}
														>
															<IconFolder className="h-4 w-4" />
															<span className="flex-1">All Files</span>
														</div>

														{/* Folder tree */}
														{folderList.length > 0 &&
															buildFolderTree(folderList).map((folder) => (
																<div key={folder.id}>{renderPickerFolder(folder)}</div>
															))}
													</ScrollArea>
												</DialogContent>
											</Dialog>
										</div>
									)}
									<input
										type="file"
										id="folder-view-upload"
										multiple
										className="hidden"
										accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
										onChange={(e) => {
											const files = Array.from(e.target.files || []);
											if (files.length > 0) {
												addFilesToUploadQueue(files, currentFolder?.id, currentFolder?.name);
											}
											e.target.value = "";
										}}
									/>
									<Button
										variant="outline"
										size="sm"
										onClick={() => document.getElementById("folder-view-upload")?.click()}
									>
										<IconUpload className="h-4 w-4 md:mr-1" />
										<span className="hidden md:inline">Upload</span>
									</Button>
									{/* Filter Dropdown */}
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="outline" size="sm">
												<IconFilter className="h-4 w-4 md:mr-1" />
												<span className="hidden md:inline">
													{selectionFilter === "all"
														? "All"
														: selectionFilter === "image"
															? "Images"
															: selectionFilter === "video"
																? "Videos"
																: "Documents"}
												</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={() => setSelectionFilter("all")}
												className={selectionFilter === "all" ? "bg-accent" : ""}
											>
												<IconFiles className="h-4 w-4 mr-2" />
												All Files
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setSelectionFilter("image")}
												className={selectionFilter === "image" ? "bg-accent" : ""}
											>
												<IconPhoto className="h-4 w-4 mr-2" />
												Images
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setSelectionFilter("video")}
												className={selectionFilter === "video" ? "bg-accent" : ""}
											>
												<IconVideo className="h-4 w-4 mr-2" />
												Videos
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setSelectionFilter("document")}
												className={selectionFilter === "document" ? "bg-accent" : ""}
											>
												<IconFile className="h-4 w-4 mr-2" />
												Documents
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</>
							)}

							<Button
								variant={viewMode === "grid" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("grid")}
								aria-label="Grid view"
							>
								<IconGrid3x3 className="h-4 w-4" />
							</Button>
							<Button
								variant={viewMode === "list" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("list")}
								aria-label="List view"
							>
								<IconList className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto" data-media-scroll="folders">
						{/* Trash View */}
						{isTrashView ? (
							<div className="space-y-4">
								{isLoadingTrash && trashPage === 1 ? (
									viewMode === "grid" ? (
										<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
											{[...Array(12)].map((_, i) => (
												<Skeleton key={i} className="aspect-square rounded-lg" />
											))}
										</div>
									) : (
										<div className="space-y-2">
											{[...Array(8)].map((_, i) => (
												<Skeleton key={i} className="h-16 rounded-lg" />
											))}
										</div>
									)
								) : allTrashedFiles.length > 0 ? (
									<>
										{viewMode === "grid" ? (
											<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
												{allTrashedFiles.map((file: any) => {
													const isSelected = selectedItems.some((item) => item.id === file.id && item.type === "file");
													const imageSrc = file.images?.small || file.images?.thumbnail || file.images?.original;
													return (
														<div
															key={file.id}
															className={`group relative rounded-lg cursor-pointer transition-colors ${
																isSelected
																	? "ring-2 ring-inset ring-primary"
																	: "hover:ring-1 hover:ring-inset hover:ring-muted-foreground/20 "
															}`}
															onClick={() =>
																toggleItemSelection({
																	id: file.id,
																	type: "file",
																	data: file,
																})
															}
														>
															{/* Thumbnail */}
															<div className="relative aspect-square rounded-md overflow-hidden bg-muted/30 m-0.5">
																{file.mimeType.startsWith("image/") && imageSrc ? (
																	<img
																		src={imageSrc}
																		alt={file.originalName}
																		loading="lazy"
																		decoding="async"
																		className="w-full h-full object-cover opacity-60"
																	/>
																) : file.mimeType.startsWith("video/") ? (
																	<>
																		{file.images?.small || file.images?.thumbnail ? (
																			<img
																				src={file.images.small || file.images.thumbnail}
																				alt={file.originalName}
																				loading="lazy"
																				decoding="async"
																				className="w-full h-full object-cover opacity-60"
																			/>
																		) : (
																			<div className="w-full h-full flex items-center justify-center bg-muted">
																				<IconVideo className="h-8 w-8 text-muted-foreground" />
																			</div>
																		)}
																	</>
																) : (
																	<div className="w-full h-full flex items-center justify-center bg-muted">
																		<IconFile className="h-8 w-8 text-muted-foreground" />
																	</div>
																)}

																{/* Checkbox */}
																<div className="absolute top-2 left-2">
																	<Checkbox checked={isSelected} />
																</div>

																{/* File name overlay */}
																<div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2">
																	<p className="text-xs text-white truncate">{file.originalName}</p>
																</div>

																{/* Quick actions */}
																<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
																	<Button
																		size="icon"
																		variant="secondary"
																		className="h-7 w-7"
																		onClick={(e) => {
																			e.stopPropagation();
																			restoreFileMutation.mutate(file.id);
																		}}
																		title="Restore"
																	>
																		<IconRestore className="h-4 w-4" />
																	</Button>
																	<Button
																		size="icon"
																		variant="destructive"
																		className="h-7 w-7"
																		onClick={(e) => {
																			e.stopPropagation();
																			setSinglePurgeFileId(file.id);
																		}}
																		title="Delete permanently"
																	>
																		<IconTrashX className="h-4 w-4" />
																	</Button>
																</div>
															</div>
														</div>
													);
												})}
											</div>
										) : (
											/* List View for Trash */
											<div className="space-y-1">
												{allTrashedFiles.map((file: any) => {
													const isSelected = selectedItems.some((item) => item.id === file.id && item.type === "file");
													const imageSrc = file.images?.thumbnail || file.images?.small || file.images?.original;
													return (
														<div
															key={file.id}
															className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
																isSelected ? "bg-primary/10 ring-2 ring-inset ring-primary" : ""
															}`}
															onClick={() =>
																toggleItemSelection({
																	id: file.id,
																	type: "file",
																	data: file,
																})
															}
														>
															{/* Checkbox */}
															<Checkbox checked={isSelected} onClick={(e) => e.stopPropagation()} />

															{/* Thumbnail */}
															<div className="relative w-12 h-12 rounded overflow-hidden bg-muted shrink-0">
																{file.mimeType.startsWith("image/") && imageSrc ? (
																	<img
																		src={imageSrc}
																		alt={file.originalName}
																		loading="lazy"
																		decoding="async"
																		className="w-full h-full object-cover opacity-60"
																	/>
																) : file.mimeType.startsWith("video/") ? (
																	<>
																		{file.images?.thumbnail ? (
																			<img
																				src={file.images.thumbnail}
																				alt={file.originalName}
																				loading="lazy"
																				className="w-full h-full object-cover opacity-60"
																			/>
																		) : (
																			<div className="w-full h-full flex items-center justify-center">
																				<IconVideo className="h-6 w-6 text-muted-foreground" />
																			</div>
																		)}
																	</>
																) : (
																	<div className="w-full h-full flex items-center justify-center">
																		<IconFile className="h-6 w-6 text-muted-foreground" />
																	</div>
																)}
															</div>

															{/* File info */}
															<div className="flex-1 min-w-0">
																<p className="font-medium truncate">{file.originalName}</p>
																<p className="text-sm text-muted-foreground">
																	{file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : ""} •{" "}
																	{file.deletedAt ? new Date(file.deletedAt).toLocaleDateString() : ""}
																</p>
															</div>

															{/* Quick actions */}
															<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
																<Button
																	size="icon"
																	variant="secondary"
																	className="h-8 w-8"
																	onClick={(e) => {
																		e.stopPropagation();
																		restoreFileMutation.mutate(file.id);
																	}}
																	title="Restore"
																>
																	<IconRestore className="h-4 w-4" />
																</Button>
																<Button
																	size="icon"
																	variant="destructive"
																	className="h-8 w-8"
																	onClick={(e) => {
																		e.stopPropagation();
																		setSinglePurgeFileId(file.id);
																	}}
																	title="Delete permanently"
																>
																	<IconTrashX className="h-4 w-4" />
																</Button>
															</div>
														</div>
													);
												})}
											</div>
										)}

										{/* Load More Trigger for Trash */}
										<div ref={trashLoadMoreRef} className="h-20 flex items-center justify-center">
											{isFetchingTrash && trashPage > 1 && (
												<div className="text-sm text-muted-foreground">Loading more...</div>
											)}
										</div>
									</>
								) : (
									<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
										<IconTrash className="h-12 w-12 mb-4" />
										<p>Trash is empty</p>
									</div>
								)}
							</div>
						) : (
							<MediaViewGrid key="folders-grid" mediaType="all" selectionFilter={selectionFilter} />
						)}
					</div>

					{/* Drag & Drop overlay */}
					{isDragging && (
						<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5"></div>
					)}
				</div>

				{/* Bulk Actions for Trash View - hide when external multi-select is active */}
				{isTrashView && !onMultiSelectCallback && selectedItems.some((item) => item.type === "file") && (
					<div className="border-t p-3 bg-muted/30 mt-auto">
						<div className="flex justify-between items-center">
							<div className="flex items-center gap-2">
								{/* Select All / Unselect All Button */}
								{(() => {
									const selectedFileIds = new Set(
										selectedItems.filter((item) => item.type === "file").map((item) => item.id),
									);
									const allSelected =
										allTrashedFiles.length > 0 && allTrashedFiles.every((f) => selectedFileIds.has(f.id));
									return (
										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												if (allSelected) {
													clearSelection();
												} else {
													// Select all trashed files
													allTrashedFiles.forEach((file) => {
														if (!selectedFileIds.has(file.id)) {
															toggleItemSelection({
																id: file.id,
																type: "file",
																data: file,
															});
														}
													});
												}
											}}
										>
											{allSelected ? "Unselect All" : "Select All"}
										</Button>
									);
								})()}
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										const fileIds = selectedItems.filter((item) => item.type === "file").map((item) => item.id);
										if (fileIds.length > 0) {
											bulkRestoreMutation.mutate(fileIds);
										}
									}}
									disabled={bulkRestoreMutation.isPending}
								>
									<IconRestore className="h-4 w-4 mr-1" />
									Restore
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowPurgeDialog(true)}
									className="text-destructive hover:text-destructive"
								>
									<IconTrashX className="h-4 w-4 mr-1" />
									Delete Permanently
								</Button>
							</div>
							<span className="text-sm text-muted-foreground">
								{selectedItems.filter((item) => item.type === "file").length} file
								{selectedItems.filter((item) => item.type === "file").length > 1 ? "s" : ""} selected
							</span>
						</div>
					</div>
				)}

				{/* Bulk Actions for Files Only (non-trash) - hide when external multi-select is active */}
				{!isTrashView && !onMultiSelectCallback && selectedItems.some((item) => item.type === "file") && (
					<div className="border-t p-3 bg-muted/30 mt-auto">
						<div className="flex justify-between items-center">
							<div className="flex items-center gap-2">
								{/* Select All / Unselect All Button */}
								{(() => {
									const selectedFileIds = new Set(
										selectedItems.filter((item) => item.type === "file").map((item) => item.id),
									);
									const allSelected = visibleFiles.length > 0 && visibleFiles.every((f) => selectedFileIds.has(f.id));
									return (
										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												if (allSelected) {
													clearSelection();
												} else {
													selectAllVisibleFiles();
												}
											}}
										>
											{allSelected ? "Unselect All" : "Select All"}
										</Button>
									);
								})()}
								<Button
									variant="outline"
									size="sm"
									title="Move selected files to folder"
									onClick={() => {
										const fileIds = selectedItems.filter((item) => item.type === "file").map((item) => item.id);
										if (fileIds.length > 0) {
											setShowMoveModal(true);
										}
									}}
								>
									<IconFolderSymlink className="h-4 w-4 mr-1" />
									<span className="hidden md:block">Move</span>
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										const fileIds = selectedItems.filter((item) => item.type === "file").map((item) => item.id);
										if (fileIds.length > 0) {
											setShowDeleteDialog(true);
										}
									}}
								>
									<IconTrash className="h-4 w-4 mr-1 text-destructive hover:text-destructive" />
									<span className="hidden md:block">Delete</span>
								</Button>
								<Button variant="ghost" size="sm" onClick={clearSelection}>
									Cancel
								</Button>
							</div>
							<span className="text-sm text-muted-foreground">
								{selectedItems.filter((item) => item.type === "file").length} file{selectedItems.length > 1 ? "s" : ""}{" "}
								selected
							</span>
						</div>
					</div>
				)}
			</div>

			{/* Create Folder Dialog */}
			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent className="sm:max-w-[425px] h-auto">
					<DialogHeader>
						<DialogTitle>
							Create New Folder
							{parentFolder && ` in "${parentFolder.name}"`}
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleCreateSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="folder-name">Folder Name</Label>
							<Input
								id="folder-name"
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
								placeholder="Enter folder name..."
								autoFocus
							/>
						</div>
						<div className="flex justify-end space-x-2">
							<Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={!newFolderName.trim() || createFolderMutation.isPending}>
								{createFolderMutation.isPending ? "Creating..." : "Create"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Rename Folder Dialog */}
			<Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
				<DialogContent className="sm:max-w-[425px] h-auto">
					<DialogHeader>
						<DialogTitle>Rename Folder &quot;{selectedFolder?.name}&quot;</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleRenameSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="rename-folder">Folder Name</Label>
							<Input
								id="rename-folder"
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
								placeholder="Enter new folder name..."
								autoFocus
							/>
						</div>
						<div className="flex justify-end space-x-2">
							<Button type="button" variant="outline" onClick={() => setShowRenameDialog(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={!newFolderName.trim() || renameFolderMutation.isPending}>
								{renameFolderMutation.isPending ? "Renaming..." : "Rename"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Move Items Modal */}
			<MediaMoveItemsModal
				open={showMoveModal}
				onOpenChange={setShowMoveModal}
				folders={folderList}
				selectedCount={selectedItems.length}
				selectedItems={selectedItems}
				onMove={handleMoveItems}
				onCreateFolder={(name, parentId) => {
					createFolderMutation.mutate({ name, parentId });
				}}
			/>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete {selectedItems.length} item
							{selectedItems.length > 1 ? "s" : ""}. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmDelete}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Purge Confirmation Dialog (Permanent Delete from Trash) */}
			<AlertDialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Permanently delete files?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete {selectedItems.filter((i) => i.type === "file").length} file
							{selectedItems.filter((i) => i.type === "file").length > 1 ? "s" : ""} from storage. This action cannot be
							undone and the files cannot be recovered.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								const fileIds = selectedItems.filter((item) => item.type === "file").map((item) => item.id);
								bulkPurgeMutation.mutate(fileIds);
							}}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							Delete Permanently
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Single File Purge Confirmation Dialog */}
			<AlertDialog open={singlePurgeFileId !== null} onOpenChange={(open) => !open && setSinglePurgeFileId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Permanently delete this file?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the file from storage. This action cannot be undone and the file cannot be
							recovered.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (singlePurgeFileId !== null) {
									purgeFileMutation.mutate(singlePurgeFileId);
								}
							}}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							Delete Permanently
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
