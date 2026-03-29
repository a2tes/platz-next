"use client";

import * as React from "react";
import { IconX, IconSearch, IconFolder, IconPhoto, IconFile, IconVideo, IconScissors } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { MediaTabs } from "./MediaTabs";
import { MediaFile } from "@/services/mediaService";

interface MediaLibraryModalProps {
	onSelect?: (files: MediaFile[]) => void;
	multiSelect?: boolean;
	fileTypes?: string[];
}

export function MediaLibraryModal({ onSelect, multiSelect = false, fileTypes }: MediaLibraryModalProps) {
	const {
		isOpen,
		activeTab,
		selectedFiles,
		currentFolder,
		closeModal,
		setActiveTab,
		setSearchQuery,
		setMultiSelect,
		clearSelection,
		selectionMode,
		selectionFilter,
		onSelectionCallback,
		onMultiSelectCallback,
		sidebarFile,
		visibleFiles,
		selectAllVisibleFiles,
	} = useMediaLibraryStore();

	// No in-modal cropping; selection simply returns to caller

	// Debounced search state
	const [localSearchQuery, setLocalSearchQuery] = React.useState("");
	const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	// Set multi-select mode when modal opens
	React.useEffect(() => {
		if (isOpen) {
			setMultiSelect(multiSelect);
		}
	}, [isOpen, multiSelect, setMultiSelect]);

	// Debounced search handler
	const handleSearchChange = (value: string) => {
		setLocalSearchQuery(value);

		// Clear existing timeout
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		// Set new timeout for debounced search
		searchTimeoutRef.current = setTimeout(() => {
			setSearchQuery(value);
		}, 300);
	};

	// Cleanup timeout on unmount
	React.useEffect(() => {
		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, []);

	const handleClose = () => {
		clearSelection();
		closeModal();
	};

	const handleSelect = () => {
		if (onSelect && selectedFiles.length > 0) {
			onSelect(selectedFiles);
		}
		handleClose();
	};

	// Handle single file selection in selector mode
	const handleSelectorSelect = (file: MediaFile) => {
		if (onSelectionCallback) {
			onSelectionCallback(file);
			handleClose();
		}
	};

	const handleTabChange = (value: string) => {
		setActiveTab(value as "images" | "videos" | "files" | "folders" | "clips");
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose} data-cid="MediaLibraryModal">
			<DialogContent className="flex flex-col h-[90vh] max-w-5xl p-0 gap-0">
				{/* Header */}
				<DialogHeader className="px-6 py-4 border-b flex-none">
					<div className="flex items-center justify-between">
						<DialogTitle>Media Library</DialogTitle>
						<div className="flex items-center space-x-4">
							{/* Search Input */}
							<div className="relative hidden md:block">
								<IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search media..."
									value={localSearchQuery}
									onChange={(e) => handleSearchChange(e.target.value)}
									className="pl-10 w-64"
								/>
							</div>

							{/* Close Button */}
							<Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
								<IconX className="h-4 w-4" />
							</Button>
						</div>
					</div>
					{/* Mobile view: Search input is hidden to save space */}
					<div className="relative md:hidden">
						<IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search media..."
							value={localSearchQuery}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="pl-10 w-full text-sm"
						/>
					</div>
				</DialogHeader>

				{/* Content */}
				<Tabs value={activeTab} onValueChange={handleTabChange} className="gap-0 flex-1 flex flex-col min-h-0">
					{/* Tab Navigation */}
					<div className="px-6 py-2 border-b flex-none">
						{(() => {
							// Determine which tabs to show based on selectionFilter
							const showImages = !selectionFilter || selectionFilter === "all" || selectionFilter === "image";
							const showVideos = !selectionFilter || selectionFilter === "all" || selectionFilter === "video";
							const showDocuments = !selectionFilter || selectionFilter === "all" || selectionFilter === "document";
							const showClips = !selectionFilter || selectionFilter === "all" || selectionFilter === "video";

							// Count visible tabs (folders is always visible)
							const visibleTabCount =
								1 + (showImages ? 1 : 0) + (showVideos ? 1 : 0) + (showDocuments ? 1 : 0) + (showClips ? 1 : 0);

							return (
								<div className="w-full">
									<TabsList className={`grid w-full grid-cols-${visibleTabCount} gap-2 whitespace-nowrap`}>
										<TabsTrigger value="folders">
											<IconFolder className="h-4 w-4" />
											<span className="hidden md:block">Folders</span>
										</TabsTrigger>
										{showImages && (
											<TabsTrigger value="images">
												<IconPhoto className="h-4 w-4" />
												<span className="hidden md:block">All images</span>
											</TabsTrigger>
										)}
										{showVideos && (
											<TabsTrigger value="videos">
												<IconVideo className="h-4 w-4" />
												<span className="hidden md:block">All videos</span>
											</TabsTrigger>
										)}
										{showDocuments && (
											<TabsTrigger value="files">
												<IconFile className="h-4 w-4" />
												<span className="hidden md:block">All documents</span>
											</TabsTrigger>
										)}
										{showClips && (
											<TabsTrigger value="clips">
												<IconScissors className="h-4 w-4" />
												<span className="hidden md:block">Clips</span>
											</TabsTrigger>
										)}
									</TabsList>
								</div>
							);
						})()}
					</div>

					{/* Tab Content */}
					<div className="flex-1 overflow-hidden relative">
						<MediaTabs fileTypes={fileTypes} selectionFilter={selectionFilter} />
					</div>
				</Tabs>

				{/* Footer */}
				{(onSelect || onMultiSelectCallback || selectionMode === "select") && (
					<div className="px-6 py-4 border-t bg-muted/50">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<div className="text-sm text-muted-foreground">
									{selectionMode === "select" && sidebarFile
										? `1 file selected`
										: selectedFiles.length > 0
											? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
											: "No files selected"}
								</div>
								{/* Select All button - only show in folders tab with multi-select and files available */}
								{activeTab === "folders" && (onMultiSelectCallback || onSelect) && visibleFiles.length > 0 && (
									<Button variant="ghost" size="sm" onClick={selectAllVisibleFiles} className="text-xs">
										Select All ({visibleFiles.length})
									</Button>
								)}
							</div>
							<div className="flex items-center space-x-2">
								<Button variant="outline" onClick={handleClose}>
									Cancel
								</Button>
								{selectionMode === "select" ? (
									<Button
										onClick={() => {
											if (sidebarFile && onSelectionCallback) {
												handleSelectorSelect(sidebarFile);
											}
										}}
										disabled={!sidebarFile}
									>
										Use
									</Button>
								) : onMultiSelectCallback ? (
									<Button
										onClick={() => {
											if (selectedFiles.length > 0) {
												onMultiSelectCallback(selectedFiles);
												handleClose();
											}
										}}
										disabled={selectedFiles.length === 0}
									>
										Select {selectedFiles.length > 0 && `(${selectedFiles.length})`}
									</Button>
								) : (
									<Button onClick={handleSelect} disabled={selectedFiles.length === 0}>
										Select {selectedFiles.length > 0 && `(${selectedFiles.length})`}
									</Button>
								)}
							</div>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
