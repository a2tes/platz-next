"use client";

import * as React from "react";
// import { TabsContent } from "@/components/ui/tabs" // Not used with manual tab control
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { MediaViewGrid } from "./MediaViewGrid";
import { MediaSidebar } from "./MediaSidebar";
import { FolderView } from "./MediaFolderView";
import { ClipsView } from "./ClipsView";

interface MediaTabsProps {
	fileTypes?: string[];
	selectionFilter?: "image" | "video" | "document" | "all";
}

export function MediaTabs({ fileTypes, selectionFilter }: MediaTabsProps) {
	const { sidebarFile, activeTab } = useMediaLibraryStore();

	// Determine which tabs to show based on selectionFilter
	const showImages = !selectionFilter || selectionFilter === "image" || selectionFilter === "all";
	const showVideos = !selectionFilter || selectionFilter === "video" || selectionFilter === "all";
	const showDocuments = !selectionFilter || selectionFilter === "document" || selectionFilter === "all";

	return (
		<div className="absolute inset-0 flex" data-cid="MediaTabs">
			{/* Main Content Area */}
			<div
				className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${sidebarFile ? "mr-80" : "mr-0"}`}
			>
				{/* Images Tab */}
				{showImages && (
					<div className={`h-full overflow-hidden px-4 pt-4 ${activeTab === "images" ? "block" : "hidden"}`}>
						<div className="h-full">
							<MediaViewGrid
								key="images-grid"
								mediaType="image"
								fileTypes={fileTypes?.filter((type) => type.startsWith("image/"))}
							/>
						</div>
					</div>
				)}
				{/* Videos Tab */}
				{showVideos && (
					<div className={`h-full overflow-hidden px-4 pt-4 ${activeTab === "videos" ? "block" : "hidden"}`}>
						<div className="h-full">
							<MediaViewGrid
								key="videos-grid"
								mediaType="video"
								fileTypes={fileTypes?.filter((type) => type.startsWith("video/"))}
							/>
						</div>
					</div>
				)}
				{/* Documents Tab */}
				{showDocuments && (
					<div className={`h-full overflow-hidden px-4 pt-4 ${activeTab === "files" ? "block" : "hidden"}`}>
						<div className="h-full">
							<MediaViewGrid
								key="documents-grid"
								mediaType="documents"
								fileTypes={fileTypes?.filter((type) => !type.startsWith("image/") && !type.startsWith("video/"))}
							/>
						</div>
					</div>
				)}{" "}
				{/* Folders Tab */}
				<div className={`h-full ${activeTab === "folders" ? "block" : "hidden"}`}>
					<FolderView key="folders-view" />
				</div>
				{/* Clips Tab */}
				<div className={`h-full overflow-hidden ${activeTab === "clips" ? "block" : "hidden"}`}>
					<ClipsView key="clips-view" />
				</div>
			</div>

			{/* Animated Sidebar */}
			<div
				className={`absolute right-0 top-0 bottom-0 w-full md:w-80 bg-background border-l z-20 transform transition-transform duration-300 ease-in-out ${
					sidebarFile ? "translate-x-0" : "translate-x-full"
				}`}
			>
				{sidebarFile && <MediaSidebar />}
			</div>
		</div>
	);
}
