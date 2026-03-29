"use client";

import * as React from "react";
import {
	IconFolder,
	IconFolderPlus,
	IconChevronRight,
} from "@tabler/icons-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MediaFolder } from "@/services/mediaService";
import { cn } from "@/lib/utils";
import { SelectedItem } from "@/stores/mediaLibraryStore";

interface MediaMoveItemsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	folders: MediaFolder[];
	selectedCount: number;
	selectedItems?: SelectedItem[];
	onMove: (targetFolderId?: number) => void;
	onCreateFolder?: (name: string, parentId?: number) => void;
}

export function MediaMoveItemsModal({
	open,
	onOpenChange,
	folders,
	selectedCount,
	selectedItems = [],
	onMove,
	onCreateFolder,
}: MediaMoveItemsModalProps) {
	const [selectedFolderId, setSelectedFolderId] = React.useState<number | null>(
		null
	);
	const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
	const [newFolderName, setNewFolderName] = React.useState("");
	const [expandedFolders, setExpandedFolders] = React.useState<number[]>([]);

	// Check if only folders are selected (no files)
	const onlyFoldersSelected =
		selectedItems.length > 0 &&
		selectedItems.every((item) => item.type === "folder");

	const toggleFolder = (folderId: number) => {
		setExpandedFolders((prev) =>
			prev.includes(folderId)
				? prev.filter((id) => id !== folderId)
				: [...prev, folderId]
		);
	};

	const handleMove = () => {
		onMove(selectedFolderId || undefined);
		onOpenChange(false);
		setSelectedFolderId(null);
	};

	const handleCreateFolder = () => {
		if (newFolderName.trim() && onCreateFolder) {
			onCreateFolder(newFolderName.trim(), selectedFolderId || undefined);
			setNewFolderName("");
			setIsCreatingFolder(false);
		}
	};

	// Build folder tree structure
	// If folders already have children property, use it directly
	// Otherwise, build hierarchy from flat list
	const buildFolderTree = (parentId: number | null = null): MediaFolder[] => {
		// Check if folders already have children (hierarchical structure)
		if (
			parentId === null &&
			folders.length > 0 &&
			folders[0].children !== undefined
		) {
			// Data is already hierarchical, return root level folders
			const rootFolders = folders.filter(
				(f) => !f.parentId || f.parentId === null
			);
			return sortFoldersWithUncategorizedFirst(rootFolders);
		}

		// Data is flat, build hierarchy
		// Filter folders where parentId matches (including undefined/null check for root)
		const filteredFolders = folders.filter((f) => {
			if (parentId === null) {
				// For root level, include folders with no parentId or parentId === null
				return !f.parentId || f.parentId === null;
			}
			return f.parentId === parentId;
		});

		return sortFoldersWithUncategorizedFirst(filteredFolders);
	};

	// Helper function to sort folders with Uncategorized always first
	const sortFoldersWithUncategorizedFirst = (
		folderList: MediaFolder[]
	): MediaFolder[] => {
		const uncategorized = folderList.find(
			(f) => f.name === "Uncategorized" && !f.parentId
		);
		const others = folderList
			.filter((f) => !(f.name === "Uncategorized" && !f.parentId))
			.sort((a, b) => a.name.localeCompare(b.name));

		return uncategorized ? [uncategorized, ...others] : others;
	};

	const renderFolder = (folder: MediaFolder, level: number = 0) => {
		// Check for children in both hierarchical and flat structures
		const hasChildren =
			(folder.children && folder.children.length > 0) ||
			folders.some((f) => f.parentId === folder.id);
		const isExpanded = expandedFolders.includes(folder.id);
		const isSelected = selectedFolderId === folder.id;

		// Get children based on structure type
		const children =
			folder.children || folders.filter((f) => f.parentId === folder.id);

		return (
			<div key={folder.id}>
				<div
					className={cn(
						"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
						isSelected && "bg-accent",
						level > 0 && "ml-4"
					)}
					style={{ paddingLeft: `${level * 16 + 8}px` }}
					onClick={() => setSelectedFolderId(folder.id)}
				>
					{hasChildren ? (
						<Collapsible
							open={isExpanded}
							onOpenChange={() => toggleFolder(folder.id)}
						>
							<CollapsibleTrigger asChild>
								<IconChevronRight
									className={cn(
										"h-4 w-4 transition-transform",
										isExpanded && "rotate-90"
									)}
								/>
							</CollapsibleTrigger>
						</Collapsible>
					) : (
						<div className="w-4" />
					)}
					<div className="flex flex-1 items-center gap-2">
						<IconFolder className="h-4 w-4" />
						<span className="flex-1">{folder.name}</span>
						{(folder.totalFileCount || folder.fileCount) > 0 && (
							<span className="text-xs text-muted-foreground">
								{folder.totalFileCount !== undefined &&
								folder.totalFileCount > 0
									? `${folder.totalFileCount} file${
											folder.totalFileCount !== 1 ? "s" : ""
									  }`
									: `${folder.fileCount || 0} file${
											(folder.fileCount || 0) !== 1 ? "s" : ""
									  }`}
							</span>
						)}
					</div>
				</div>
				{hasChildren && isExpanded && (
					<div>{children.map((child) => renderFolder(child, level + 1))}</div>
				)}
			</div>
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						Move {selectedCount} item{selectedCount > 1 ? "s" : ""}
					</DialogTitle>
					<DialogDescription>
						Select a destination folder or create a new one
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Root folder option - only show for folders */}
					{onlyFoldersSelected && (
						<div
							className={cn(
								"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
								selectedFolderId === null && "bg-accent"
							)}
							onClick={() => setSelectedFolderId(null)}
						>
							<IconFolder className="h-4 w-4" />
							<span className="flex-1">Root</span>
						</div>
					)}

					{/* Folder tree */}
					<ScrollArea className="h-[300px] rounded-md border p-2">
						{buildFolderTree(null).map((folder) => renderFolder(folder))}
					</ScrollArea>

					{/* Create new folder */}
					{onCreateFolder && (
						<div className="space-y-2">
							{isCreatingFolder ? (
								<div className="flex gap-2">
									<div className="flex-1">
										<Label htmlFor="folderName">New Folder Name</Label>
										<Input
											id="folderName"
											value={newFolderName}
											onChange={(e) => setNewFolderName(e.target.value)}
											placeholder="Enter folder name"
											onKeyDown={(e) => {
												if (e.key === "Enter") handleCreateFolder();
												if (e.key === "Escape") {
													setIsCreatingFolder(false);
													setNewFolderName("");
												}
											}}
										/>
									</div>
									<Button
										onClick={handleCreateFolder}
										disabled={!newFolderName.trim()}
										className="mt-6"
									>
										Create
									</Button>
									<Button
										variant="outline"
										onClick={() => {
											setIsCreatingFolder(false);
											setNewFolderName("");
										}}
										className="mt-6"
									>
										Cancel
									</Button>
								</div>
							) : (
								<Button
									variant="outline"
									onClick={() => setIsCreatingFolder(true)}
									className="w-full gap-2"
								>
									<IconFolderPlus className="h-4 w-4" />
									Create New Folder
								</Button>
							)}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleMove}>
						Move to{" "}
						{selectedFolderId === null
							? onlyFoldersSelected
								? "Root"
								: "Uncategorized"
							: "Selected Folder"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
