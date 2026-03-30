"use client";

import * as React from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	IconX,
	IconGripVertical,
	IconTrash,
	IconSettings,
	IconEye,
	IconEdit,
	IconPlus,
	IconSquareNumber1,
	IconSquareNumber2,
	IconSquareNumber3,
	IconSquareNumber4,
	IconLayoutSidebar,
	IconLayoutSidebarRight,
	IconMovie,
	IconPhoto,
	IconVideo,
	IconArrowLeft,
	IconArrowRight,
	IconScissors,
	IconAlertTriangle,
	IconRefresh,
} from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBlockEditorStore } from "@/stores/blockEditorStore";
import { VideoSettingsModal } from "./VideoSettingsModal";
import { blocksService, blockPagesService } from "@/services/blocksService";
import { WorksService, type Work } from "@/services/worksService";
import { AnimationsService, type Animation } from "@/services/animationsService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { MediaService, type MediaFile } from "@/services/mediaService";
import { toast } from "sonner";
import { useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

// Block type definitions
type BlockType = "ONE_COLUMN" | "TWO_COLUMN" | "THREE_COLUMN" | "FOUR_COLUMN" | "ONE_TWO" | "TWO_ONE";

interface CropSettings {
	x: number;
	y: number;
	width: number;
	height: number;
	aspect: number;
}

interface TrimSettings {
	startTime: number;
	endTime: number;
}

interface BlockContentItem {
	// Entity reference
	workId?: number;
	animationId?: number;
	// Source media file ID (for existing clip lookup)
	sourceMediaId?: number;
	// Display mode: "video" plays clip, "thumbnail" shows static image
	displayMode?: "video" | "thumbnail";
	// Structured work/animation data from API
	work?: {
		title: string;
		slug?: string;
		videoUrl: string | null;
		videoAspectRatio: number;
		thumbnailUrl: string | null;
		thumbnailAspectRatio: number;
	};
	animation?: {
		title: string;
		slug?: string;
		videoUrl: string | null;
		videoAspectRatio: number;
		thumbnailUrl: string | null;
		thumbnailAspectRatio: number;
	};
	// Clip object — only present when displayMode is "video"
	clip?: {
		videoUrl: string | null;
		thumbnailUrl: string | null;
		status: "pending" | "processing" | "completed" | "failed" | null;
		error: string | null;
		cropSettings: CropSettings | null;
		trimSettings: TrimSettings | null;
	};
}

interface Block {
	id: string;
	type: BlockType;
	content: (BlockContentItem | null)[];
	sortOrder: number;
}

// Block type configurations
const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode; slots: number }[] = [
	{ type: "ONE_COLUMN", label: "1 Column", icon: <IconSquareNumber1 className="w-5 h-5" />, slots: 1 },
	{ type: "TWO_COLUMN", label: "2 Columns", icon: <IconSquareNumber2 className="w-5 h-5" />, slots: 2 },
	{ type: "THREE_COLUMN", label: "3 Columns", icon: <IconSquareNumber3 className="w-5 h-5" />, slots: 3 },
	{ type: "FOUR_COLUMN", label: "4 Columns", icon: <IconSquareNumber4 className="w-5 h-5" />, slots: 4 },
	{ type: "ONE_TWO", label: "1:2 Split", icon: <IconLayoutSidebar className="w-5 h-5" />, slots: 2 },
	{ type: "TWO_ONE", label: "2:1 Split", icon: <IconLayoutSidebarRight className="w-5 h-5" />, slots: 2 },
];

// Get column count from block type
function getSlotCount(type: BlockType): number {
	return BLOCK_TYPES.find((bt) => bt.type === type)?.slots || 1;
}

// Helper to get entity data from a block content item
function getEntity(item: BlockContentItem) {
	return item.work || item.animation || null;
}

// Sortable Block Item
function SortableBlockItem({
	block,
	onDelete,
	onSlotClick,
	onVideoSettings,
	onMoveSlot,
	onToggleDisplayMode,
	onRetryClip,
}: {
	block: Block;
	onDelete: () => void;
	onSlotClick: (slotIndex: number) => void;
	onVideoSettings: (slotIndex: number) => void;
	onMoveSlot: (fromIndex: number, toIndex: number) => void;
	onToggleDisplayMode: (slotIndex: number) => void;
	onRetryClip: (slotIndex: number) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: block.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	// Grid classes based on block type
	const gridClass = {
		ONE_COLUMN: "grid-cols-1",
		TWO_COLUMN: "grid-cols-2",
		THREE_COLUMN: "grid-cols-3",
		FOUR_COLUMN: "grid-cols-4",
		ONE_TWO: "grid-cols-3",
		TWO_ONE: "grid-cols-3",
	}[block.type];

	return (
		<div ref={setNodeRef} style={style} className="border rounded-lg bg-card mb-3">
			{/* Block Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 rounded-t-lg">
				<div className="flex items-center gap-2">
					<button
						{...attributes}
						{...listeners}
						className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
					>
						<IconGripVertical className="w-4 h-4 text-muted-foreground" />
					</button>
					<span className="text-sm font-medium">
						{BLOCK_TYPES.find((bt) => bt.type === block.type)?.label || block.type}
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onDelete}
					className="h-7 w-7 text-destructive hover:text-destructive"
				>
					<IconTrash className="w-4 h-4" />
				</Button>
			</div>

			{/* Block Content Slots */}
			<div className={`grid ${gridClass} gap-2 p-3 items-start`}>
				{block.content.map((item, slotIndex) => {
					// Handle ONE_TWO and TWO_ONE special grid spans
					let spanClass = "";
					if (block.type === "ONE_TWO") {
						spanClass = slotIndex === 0 ? "col-span-1" : "col-span-2";
					} else if (block.type === "TWO_ONE") {
						spanClass = slotIndex === 0 ? "col-span-2" : "col-span-1";
					}

					const entity = item ? getEntity(item) : null;

					return (
						<div key={slotIndex} className={`relative bg-muted rounded-md overflow-hidden group ${spanClass}`}>
							{item && entity ? (
								<>
									{/* Edit Mode: Always show thumbnail — prefer clip thumbnail over work/animation thumbnail */}
									{item.clip?.thumbnailUrl || entity.thumbnailUrl ? (
										<img
											src={item.clip?.thumbnailUrl || entity.thumbnailUrl!}
											alt=""
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center bg-muted">
											<div className="flex flex-col items-center gap-2">
												<div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
												<span className="text-xs text-muted-foreground font-medium">Generating...</span>
											</div>
										</div>
									)}

									{/* Clip status overlays */}
									{item.clip?.status === "pending" || item.clip?.status === "processing" ? (
										<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
											<div className="flex flex-col items-center gap-2">
												<div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
												<span className="text-xs text-white font-medium">Processing clip...</span>
											</div>
										</div>
									) : item.clip?.status === "failed" ? (
										<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
											<div className="flex flex-col items-center gap-2">
												<IconAlertTriangle className="w-6 h-6 text-red-400" />
												<span className="text-xs text-red-300 font-medium text-center px-4">
													{item.clip.error || "Clip processing failed"}
												</span>
												<Button
													size="sm"
													variant="secondary"
													onClick={(e) => {
														e.stopPropagation();
														onRetryClip(slotIndex);
													}}
													className="h-7 text-xs mt-1"
												>
													<IconRefresh className="w-3 h-3 mr-1" />
													Retry
												</Button>
											</div>
										</div>
									) : null}

									{/* Title Badge */}
									{entity.title && (
										<div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5">
											{/* Display mode indicator */}
											{item.displayMode === "thumbnail" ? (
												<IconPhoto className="w-3 h-3 text-blue-400" />
											) : item.clip?.cropSettings || item.clip?.trimSettings ? (
												<IconScissors className="w-3 h-3 text-yellow-400" />
											) : null}
											{entity.title}
										</div>
									)}
									{/* Overlay Actions */}
									<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
										{/* Move Left Button */}
										{slotIndex > 0 && (
											<Button
												size="sm"
												variant="secondary"
												onClick={() => onMoveSlot(slotIndex, slotIndex - 1)}
												className="h-8 w-8 p-0"
												title="Move left"
											>
												<IconArrowLeft className="w-4 h-4" />
											</Button>
										)}
										{entity.videoUrl && (
											<Button size="sm" variant="secondary" onClick={() => onVideoSettings(slotIndex)} className="h-8">
												<IconSettings className="w-4 h-4" />
											</Button>
										)}
										{/* Toggle Video/Thumbnail mode */}
										{entity.videoUrl && (
											<Button
												size="sm"
												variant="secondary"
												onClick={() => onToggleDisplayMode(slotIndex)}
												className="h-8"
												title={item.displayMode === "thumbnail" ? "Switch to video clip" : "Switch to thumbnail"}
											>
												{item.displayMode === "thumbnail" ? (
													<IconVideo className="w-4 h-4" />
												) : (
													<IconPhoto className="w-4 h-4" />
												)}
											</Button>
										)}
										<Button size="sm" variant="secondary" onClick={() => onSlotClick(slotIndex)} className="h-8">
											<IconEdit className="w-4 h-4" />
										</Button>
										{/* Move Right Button */}
										{slotIndex < block.content.length - 1 && (
											<Button
												size="sm"
												variant="secondary"
												onClick={() => onMoveSlot(slotIndex, slotIndex + 1)}
												className="h-8 w-8 p-0"
												title="Move right"
											>
												<IconArrowRight className="w-4 h-4" />
											</Button>
										)}
									</div>
								</>
							) : (
								<button
									onClick={() => onSlotClick(slotIndex)}
									className="w-full h-full flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
								>
									<IconPlus className="w-8 h-8 mb-1" />
									<span className="text-xs">Add Content</span>
								</button>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// Block Palette - Add new blocks
function BlockPalette({ onAddBlock }: { onAddBlock: (type: BlockType) => void }) {
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-medium text-muted-foreground mb-3">Add Block</h3>
			<div className="grid grid-cols-2 gap-2">
				{BLOCK_TYPES.map((bt) => (
					<button
						key={bt.type}
						onClick={() => onAddBlock(bt.type)}
						className="flex flex-col items-center justify-center p-3 border rounded-lg hover:bg-muted transition-colors"
					>
						{bt.icon}
						<span className="text-xs mt-1">{bt.label}</span>
					</button>
				))}
			</div>
		</div>
	);
}

// Main Block Editor Modal
export function BlockEditorModal() {
	const queryClient = useQueryClient();
	const { isOpen, modelName, modelId, title, closeBlockEditor } = useBlockEditorStore();

	// Local state for blocks
	const [blocks, setBlocks] = React.useState<Block[]>([]);
	const [originalBlockIds, setOriginalBlockIds] = React.useState<string[]>([]); // Track original IDs for deletion
	const [previewMode, setPreviewMode] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const [pendingSlotClick, setPendingSlotClick] = React.useState<{ blockId: string; slotIndex: number } | null>(null);

	// Content selector modal state
	const [isContentSelectorOpen, setIsContentSelectorOpen] = React.useState(false);
	const [workSearchQuery, setWorkSearchQuery] = React.useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
	const [pageType, setPageType] = React.useState<"WORKS" | "ANIMATIONS" | null>(null);

	// Debounce search query
	React.useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearchQuery(workSearchQuery), 300);
		return () => clearTimeout(timer);
	}, [workSearchQuery]);

	// Video settings state
	const [isVideoSettingsOpen, setIsVideoSettingsOpen] = React.useState(false);
	const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
	const [selectedSlotIndex, setSelectedSlotIndex] = React.useState<number | null>(null);
	const [videoSettingsData, setVideoSettingsData] = React.useState<{
		mediaUrl: string;
		cropSettings?: CropSettings | null;
		trimSettings?: TrimSettings | null;
		mode?: "clip" | "thumbnail";
		sourceMediaId?: number;
	} | null>(null);

	const isAnimationsMode = pageType === "ANIMATIONS";

	// Fetch works for selector with infinite scroll
	const {
		data: worksData,
		fetchNextPage: fetchNextWorksPage,
		hasNextPage: hasNextWorksPage,
		isFetchingNextPage: isFetchingNextWorksPage,
		isLoading: isWorksLoading,
	} = useInfiniteQuery({
		queryKey: ["works", "selector", debouncedSearchQuery],
		queryFn: ({ pageParam = 1 }) =>
			WorksService.getWorks({
				page: pageParam,
				limit: 10,
				status: "PUBLISHED",
				...(debouncedSearchQuery ? { search: debouncedSearchQuery } : {}),
			}),
		getNextPageParam: (lastPage) => {
			const { page, totalPages } = lastPage.meta.pagination;
			return page < totalPages ? page + 1 : undefined;
		},
		initialPageParam: 1,
		enabled: isContentSelectorOpen && !isAnimationsMode,
	});

	// Fetch animations for selector with infinite scroll
	const {
		data: animationsData,
		fetchNextPage: fetchNextAnimationsPage,
		hasNextPage: hasNextAnimationsPage,
		isFetchingNextPage: isFetchingNextAnimationsPage,
		isLoading: isAnimationsLoading,
	} = useInfiniteQuery({
		queryKey: ["animations", "selector", debouncedSearchQuery],
		queryFn: ({ pageParam = 1 }) =>
			AnimationsService.getAnimations({
				page: pageParam,
				limit: 10,
				status: "PUBLISHED",
				...(debouncedSearchQuery ? { search: debouncedSearchQuery } : {}),
			}),
		getNextPageParam: (lastPage) => {
			const { page, totalPages } = lastPage.meta.pagination;
			return page < totalPages ? page + 1 : undefined;
		},
		initialPageParam: 1,
		enabled: isContentSelectorOpen && isAnimationsMode,
	});

	// Flatten all pages into entity lists
	const allWorks = React.useMemo(() => {
		if (!worksData?.pages) return [];
		return worksData.pages.flatMap((page) => page.data);
	}, [worksData?.pages]);

	const allAnimations = React.useMemo(() => {
		if (!animationsData?.pages) return [];
		return animationsData.pages.flatMap((page) => page.data);
	}, [animationsData?.pages]);

	// Unified entity list and loading state
	const allEntities = isAnimationsMode ? allAnimations : allWorks;
	const isEntitiesLoading = isAnimationsMode ? isAnimationsLoading : isWorksLoading;
	const isFetchingNextPage = isAnimationsMode ? isFetchingNextAnimationsPage : isFetchingNextWorksPage;
	const hasNextPage = isAnimationsMode ? hasNextAnimationsPage : hasNextWorksPage;
	const fetchNextPage = isAnimationsMode ? fetchNextAnimationsPage : fetchNextWorksPage;

	// Scroll handler for infinite loading
	const handleWorksScroll = React.useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const target = e.currentTarget;
			const threshold = 100;
			if (
				target.scrollHeight - target.scrollTop - target.clientHeight < threshold &&
				hasNextPage &&
				!isFetchingNextPage
			) {
				fetchNextPage();
			}
		},
		[hasNextPage, isFetchingNextPage, fetchNextPage],
	);

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	);

	// Load blocks when modal opens
	React.useEffect(() => {
		if (isOpen && modelName && modelId) {
			loadBlocks();
		} else {
			// Reset state when modal closes
			setBlocks([]);
			setOriginalBlockIds([]);
			setPreviewMode(false);
			setIsVideoSettingsOpen(false);
			setSelectedBlockId(null);
			setSelectedSlotIndex(null);
			setVideoSettingsData(null);
			setPageType(null);
		}
	}, [isOpen, modelName, modelId]);

	const loadBlocks = async () => {
		if (!modelName || !modelId) return;

		setIsLoading(true);
		try {
			// Determine page type for BlockPage models
			if (modelName === "BlockPage") {
				try {
					const pages = await blockPagesService.getBlockPages();
					const page = pages.find((p: any) => p.id === modelId);
					if (page) {
						setPageType(page.type as "WORKS" | "ANIMATIONS");
					}
				} catch {
					// Default to WORKS if page type can't be determined
					setPageType("WORKS");
				}
			}

			const existingBlocks = await blocksService.getBlocks({ modelName, modelId });
			// Convert API blocks to local block format
			const localBlocks: Block[] = existingBlocks.map((b) => {
				const blockType = b.type as BlockType;
				const slotCount = getSlotCount(blockType);
				const items = Array.isArray(b.content?.items) ? b.content.items : [];

				// API response already matches BlockContentItem structure
				const convertedItems = items.map((apiItem: any) => {
					if (!apiItem) return null;
					if (!apiItem.work && !apiItem.animation) return null;
					return {
						workId: apiItem.workId,
						animationId: apiItem.animationId,
						displayMode: apiItem.displayMode || "video",
						work: apiItem.work,
						animation: apiItem.animation,
						clip: apiItem.clip,
					} as BlockContentItem;
				});

				// Ensure content array has correct number of slots for the block type
				const content: (BlockContentItem | null)[] = Array(slotCount)
					.fill(null)
					.map((_, index) => convertedItems[index] || null);

				return {
					id: String(b.id),
					type: blockType,
					content,
					sortOrder: b.position,
				};
			});
			setBlocks(localBlocks);
			setOriginalBlockIds(localBlocks.map((b) => b.id)); // Track original IDs
		} catch (error) {
			console.error("Failed to load blocks:", error);
			toast.error("Failed to load blocks");
		} finally {
			setIsLoading(false);
		}
	};

	// SSE connection for real-time clip processing updates
	React.useEffect(() => {
		if (!isOpen || blocks.length === 0) return;

		// Get all non-temp block IDs to subscribe to
		const blockIds = blocks.filter((b) => !b.id.startsWith("temp-")).map((b) => parseInt(b.id));
		if (blockIds.length === 0) return;

		const eventSources: EventSource[] = [];
		const apiBaseUrl =
			`${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}` ||
			`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

		// Create EventSource for each block
		// withCredentials: true ensures httpOnly cookies are sent for authentication
		for (const blockId of blockIds) {
			try {
				const eventSource = new EventSource(`${apiBaseUrl}/api/blocks/${blockId}/events`, {
					withCredentials: true,
				});

				eventSource.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						console.log("[SSE] Received event:", data);

						// Handle clip updates
						if (data.type === "clip_complete" || data.type === "clip_failed") {
							setBlocks((prevBlocks) =>
								prevBlocks.map((block) => {
									if (block.id !== String(blockId)) return block;

									const newContent = [...block.content];
									const slotIndex = data.slotIndex;

									if (slotIndex >= 0 && slotIndex < newContent.length && newContent[slotIndex]) {
										const item = newContent[slotIndex]!;
										newContent[slotIndex] = {
											...item,
											clip: {
												...item.clip,
												status: data.status === "COMPLETED" ? "completed" : "failed",
												videoUrl: data.outputUrl || item.clip?.videoUrl || null,
												thumbnailUrl: data.thumbnailUrl || item.clip?.thumbnailUrl || null,
												error: data.error || null,
												cropSettings: item.clip?.cropSettings || null,
												trimSettings: item.clip?.trimSettings || null,
											},
										};

										if (data.type === "clip_complete") {
											toast.success(`Clip processing completed for slot ${slotIndex + 1}`);
										} else {
											toast.error(`Clip processing failed: ${data.error || "Unknown error"}`);
										}
									}

									return { ...block, content: newContent };
								}),
							);
						}

						// Handle thumbnail updates
						if (data.type === "thumbnail_complete" || data.type === "thumbnail_failed") {
							setBlocks((prevBlocks) =>
								prevBlocks.map((block) => {
									if (block.id !== String(blockId)) return block;

									const newContent = [...block.content];
									const slotIndex = data.slotIndex;

									if (slotIndex >= 0 && slotIndex < newContent.length && newContent[slotIndex]) {
										const item = newContent[slotIndex]!;
										const entity = getEntity(item);
										if (entity) {
											// Update the entity's thumbnailUrl with the generated thumbnail
											const entityKey = item.work ? "work" : "animation";
											newContent[slotIndex] = {
												...item,
												[entityKey]: {
													...item[entityKey],
													thumbnailUrl: data.thumbnailUrl || entity.thumbnailUrl,
												},
											};
										}

										if (data.type === "thumbnail_complete") {
											toast.success(`Thumbnail generated for slot ${slotIndex + 1}`);
										} else {
											toast.error(`Thumbnail generation failed: ${data.error || "Unknown error"}`);
										}
									}

									return { ...block, content: newContent };
								}),
							);
						}
					} catch (err) {
						console.error("[SSE] Failed to parse event:", err);
					}
				};

				eventSource.onerror = (error) => {
					console.warn(`[SSE] Connection error for block ${blockId}:`, error);
					// EventSource will automatically try to reconnect
				};

				eventSources.push(eventSource);
			} catch (err) {
				console.error(`[SSE] Failed to create EventSource for block ${blockId}:`, err);
			}
		}

		// Cleanup on unmount or when blocks change
		return () => {
			eventSources.forEach((es) => es.close());
		};
	}, [isOpen, blocks.map((b) => b.id).join(",")]); // Re-subscribe when block IDs change

	// Save mutation
	const saveMutation = useMutation({
		mutationFn: async () => {
			if (!modelName || !modelId) throw new Error("No model context");

			// Find blocks that were deleted (existed originally but not in current blocks)
			const currentBlockIds = blocks.map((b) => b.id);
			const deletedBlockIds = originalBlockIds.filter((id) => !id.startsWith("temp-") && !currentBlockIds.includes(id));

			// Delete removed blocks (ignore 404 errors if block was already deleted)
			for (const id of deletedBlockIds) {
				try {
					await blocksService.deleteBlock(parseInt(id));
				} catch (error: any) {
					// Ignore 404 errors - block may have been deleted already
					const status = error?.response?.status || error?.status;
					if (status !== 404) {
						console.warn(`Failed to delete block ${id}:`, error);
						// Don't throw - continue with other operations
					}
				}
			}

			// Save each remaining block
			for (let i = 0; i < blocks.length; i++) {
				const block = blocks[i];
				const isNew = block.id.startsWith("temp-");

				// For existing blocks, fetch current DB content to preserve processedVideo/generatedThumbnail
				// (these fields are managed by the clip processing pipeline and may have been updated by webhooks)
				let dbItems: any[] = [];
				if (!isNew) {
					try {
						const dbBlock = await blocksService.getBlock(parseInt(block.id));
						dbItems = dbBlock?.content?.items || [];
					} catch {
						// If fetch fails, proceed without DB data
					}
				}

				// Filter out null items and serialize to DB format
				const contentItems = block.content
					.filter((item): item is BlockContentItem => item !== null && !!(item.workId || item.animationId))
					.map((item, index) => {
						// Find matching DB item to preserve processedVideo/generatedThumbnail
						const dbItem = dbItems[index];
						const dbProcessedVideo =
							dbItem && dbItem.workId === item.workId && dbItem.animationId === item.animationId
								? dbItem.processedVideo
								: undefined;
						const dbGeneratedThumbnail =
							dbItem && dbItem.workId === item.workId && dbItem.animationId === item.animationId
								? dbItem.generatedThumbnail
								: undefined;

						return {
							...(item.workId && { workId: item.workId }),
							...(item.animationId && { animationId: item.animationId }),
							displayMode: item.displayMode || "video",
							cropSettings: item.clip?.cropSettings || undefined,
							trimSettings: item.clip?.trimSettings || undefined,
							// Preserve processedVideo from DB (source of truth, updated by webhooks)
							// Fall back to local state for new blocks or if DB fetch failed
							processedVideo:
								dbProcessedVideo ||
								(item.clip?.status
									? {
											status: item.clip.status,
											...(item.clip.videoUrl && { url: item.clip.videoUrl }),
											...(item.clip.thumbnailUrl && { thumbnailUrl: item.clip.thumbnailUrl }),
											...(item.clip.error && { error: item.clip.error }),
										}
									: undefined),
							// Preserve generatedThumbnail from DB
							...(dbGeneratedThumbnail && { generatedThumbnail: dbGeneratedThumbnail }),
						};
					});

				// Skip saving entirely empty blocks (no content in any slot)
				if (contentItems.length === 0) {
					// If block existed before, delete it
					if (!isNew) {
						try {
							await blocksService.deleteBlock(parseInt(block.id));
						} catch (error: any) {
							const status = error?.response?.status || error?.status;
							if (status !== 404) console.warn(`Failed to delete empty block ${block.id}:`, error);
						}
					}
					continue;
				}
				if (isNew) {
					await blocksService.createBlock({
						modelName,
						modelId,
						type: block.type as any,
						content: { items: contentItems },
						position: i,
					});
				} else {
					await blocksService.updateBlock(parseInt(block.id), {
						type: block.type as any,
						content: { items: contentItems },
						position: i,
					});
				}
			}
		},
		onSuccess: () => {
			toast.success("Blocks saved successfully");
			queryClient.invalidateQueries({ queryKey: ["blocks", modelName, modelId] });
			// Reload blocks to sync local state with DB (processedVideo may have been updated by webhooks)
			loadBlocks();
		},
		onError: (error) => {
			console.error("Failed to save blocks:", error);
			toast.error("Failed to save blocks");
		},
	});

	const handleSave = () => {
		saveMutation.mutate();
	};

	// Handle drag end for reordering
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = blocks.findIndex((b) => b.id === active.id);
		const newIndex = blocks.findIndex((b) => b.id === over.id);

		setBlocks(arrayMove(blocks, oldIndex, newIndex));
	};

	// Handle adding a new block
	const handleAddBlock = (type: BlockType) => {
		const slotCount = getSlotCount(type);
		const newBlock: Block = {
			id: `temp-${Date.now()}`,
			type,
			content: Array(slotCount).fill(null),
			sortOrder: blocks.length,
		};
		setBlocks([...blocks, newBlock]);
	};

	// Handle deleting a block
	const handleDeleteBlock = (blockId: string) => {
		setBlocks(blocks.filter((b) => b.id !== blockId));
	};

	// Handle updating a block
	const handleUpdateBlock = (blockId: string, updates: Partial<Block>) => {
		setBlocks(blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)));
	};

	// Handle moving slot content within a block
	const handleMoveSlot = (blockId: string, fromIndex: number, toIndex: number) => {
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return;

		const newContent = [...block.content];
		const [movedItem] = newContent.splice(fromIndex, 1);
		newContent.splice(toIndex, 0, movedItem);

		handleUpdateBlock(blockId, { content: newContent });
	};

	// Handle slot click to add/change content
	const handleSlotClick = (blockId: string, slotIndex: number) => {
		setPendingSlotClick({ blockId, slotIndex });
		setWorkSearchQuery("");
		setIsContentSelectorOpen(true);
	};

	// Handle toggling display mode between video and thumbnail
	const handleToggleDisplayMode = (blockId: string, slotIndex: number) => {
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return;

		const item = block.content[slotIndex];
		if (!item) return;

		const newContent = [...block.content];
		const currentMode = item.displayMode || "video";
		const newMode = currentMode === "video" ? "thumbnail" : "video";

		newContent[slotIndex] = {
			...item,
			displayMode: newMode,
			// When switching to thumbnail, clear clip state
			...(newMode === "thumbnail" ? { clip: undefined } : {}),
		};

		handleUpdateBlock(blockId, { content: newContent });
		toast.info(newMode === "thumbnail" ? "Switched to thumbnail mode" : "Switched to video clip mode");
	};

	// Handle Work selected from list
	const handleWorkSelected = async (work: Work) => {
		if (!pendingSlotClick) return;

		const { blockId, slotIndex } = pendingSlotClick;
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return;

		// Get video/media from work
		const videoUrl = work.videoFile?.video?.default || work.videoFile?.video?.original || null;
		const thumbnailUrl =
			work.previewImage?.images?.thumbnail ||
			work.previewImage?.images?.large ||
			work.videoFile?.images?.thumbnail ||
			null;

		const newItem: BlockContentItem = {
			workId: work.id,
			sourceMediaId: work.videoFileId ?? undefined,
			displayMode: "video",
			work: {
				title: work.title,
				slug: work.slug,
				videoUrl,
				videoAspectRatio: 16 / 9,
				thumbnailUrl,
				thumbnailAspectRatio: 16 / 9,
			},
		};

		// Check if the work's video has a default clip
		if (work.videoFileId) {
			try {
				const defaultClip = await MediaService.getDefaultClip(work.videoFileId);
				if (defaultClip && defaultClip.status === "COMPLETED") {
					newItem.clip = {
						videoUrl: defaultClip.outputUrl || null,
						thumbnailUrl: defaultClip.thumbnailUrl || null,
						status: "completed",
						error: null,
						cropSettings: defaultClip.cropSettings as CropSettings | null,
						trimSettings: defaultClip.trimSettings as TrimSettings | null,
					};
				} else if (defaultClip && (defaultClip.status === "PENDING" || defaultClip.status === "PROCESSING")) {
					newItem.clip = {
						videoUrl: null,
						thumbnailUrl: null,
						status: defaultClip.status.toLowerCase() as "pending" | "processing",
						error: null,
						cropSettings: defaultClip.cropSettings as CropSettings | null,
						trimSettings: defaultClip.trimSettings as TrimSettings | null,
					};
				}
			} catch {
				// No default clip — continue without it
			}
		}

		const newContent = [...block.content];
		newContent[slotIndex] = newItem;

		handleUpdateBlock(blockId, { content: newContent });
		setIsContentSelectorOpen(false);
		setPendingSlotClick(null);
	};

	// Handle Animation selected from list
	const handleAnimationSelected = async (animation: Animation) => {
		if (!pendingSlotClick) return;

		const { blockId, slotIndex } = pendingSlotClick;
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return;

		// Get video/media from animation
		const videoUrl = animation.videoFile?.video?.default || animation.videoFile?.video?.original || null;
		const thumbnailUrl =
			animation.previewImage?.images?.thumbnail ||
			animation.previewImage?.images?.large ||
			animation.videoFile?.images?.thumbnail ||
			null;

		const newItem: BlockContentItem = {
			animationId: animation.id,
			sourceMediaId: animation.videoFileId ?? undefined,
			displayMode: "video",
			animation: {
				title: animation.title,
				slug: animation.slug,
				videoUrl,
				videoAspectRatio: 16 / 9,
				thumbnailUrl,
				thumbnailAspectRatio: 16 / 9,
			},
		};

		// Check if the animation's video has a default clip
		if (animation.videoFileId) {
			try {
				const defaultClip = await MediaService.getDefaultClip(animation.videoFileId);
				if (defaultClip && defaultClip.status === "COMPLETED") {
					newItem.clip = {
						videoUrl: defaultClip.outputUrl || null,
						thumbnailUrl: defaultClip.thumbnailUrl || null,
						status: "completed",
						error: null,
						cropSettings: defaultClip.cropSettings as CropSettings | null,
						trimSettings: defaultClip.trimSettings as TrimSettings | null,
					};
				} else if (defaultClip && (defaultClip.status === "PENDING" || defaultClip.status === "PROCESSING")) {
					newItem.clip = {
						videoUrl: null,
						thumbnailUrl: null,
						status: defaultClip.status.toLowerCase() as "pending" | "processing",
						error: null,
						cropSettings: defaultClip.cropSettings as CropSettings | null,
						trimSettings: defaultClip.trimSettings as TrimSettings | null,
					};
				}
			} catch {
				// No default clip — continue without it
			}
		}

		const newContent = [...block.content];
		newContent[slotIndex] = newItem;

		handleUpdateBlock(blockId, { content: newContent });
		setIsContentSelectorOpen(false);
		setPendingSlotClick(null);
	};

	// Handle media selected from library (for direct media selection)
	const handleMediaSelected = (_file: MediaFile) => {
		// Direct media selection is not supported — only works/animations can be added to blocks
		toast.info("Please select a work or animation instead");
		setIsContentSelectorOpen(false);
		setPendingSlotClick(null);
	};

	// Open media library for direct media selection
	const handleOpenMediaLibrary = () => {
		setIsContentSelectorOpen(false);
		const { openSelectorModal } = useMediaLibraryStore.getState();
		openSelectorModal("video", handleMediaSelected);
	};

	// Handle opening video settings
	const handleOpenVideoSettings = (blockId: string, slotIndex: number) => {
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return;

		const item = block.content[slotIndex];
		if (!item) return;

		const entity = getEntity(item);
		if (!entity?.videoUrl) return;

		const settingsMode = item.displayMode === "thumbnail" ? "thumbnail" : "clip";

		setSelectedBlockId(blockId);
		setSelectedSlotIndex(slotIndex);
		setVideoSettingsData({
			mediaUrl: entity.videoUrl,
			cropSettings: item.clip?.cropSettings,
			trimSettings: item.clip?.trimSettings,
			mode: settingsMode,
			sourceMediaId: item.sourceMediaId,
		});
		setIsVideoSettingsOpen(true);
	};

	// Handle closing video settings
	const handleCloseVideoSettings = () => {
		setIsVideoSettingsOpen(false);
		setSelectedBlockId(null);
		setSelectedSlotIndex(null);
		setVideoSettingsData(null);
	};

	// Handle video settings save
	const handleSaveVideoSettings = async (settings: { cropSettings?: CropSettings; trimSettings?: TrimSettings }) => {
		if (!selectedBlockId || selectedSlotIndex === null) return;
		if (!modelName || !modelId) return;

		const block = blocks.find((b) => b.id === selectedBlockId);
		if (!block) return;

		const newContent = [...block.content];
		const item = newContent[selectedSlotIndex];
		if (!item) return;

		const isThumbnailMode = videoSettingsData?.mode === "thumbnail";

		// Update local state with new settings in the clip object
		newContent[selectedSlotIndex] = {
			...item,
			clip: {
				videoUrl: item.clip?.videoUrl || null,
				thumbnailUrl: item.clip?.thumbnailUrl || null,
				status: "pending",
				error: null,
				cropSettings: settings.cropSettings || null,
				trimSettings: isThumbnailMode ? null : settings.trimSettings || null,
			},
		};

		handleUpdateBlock(selectedBlockId, { content: newContent });

		const hasCropOrTrim = settings.cropSettings || settings.trimSettings;
		if (!hasCropOrTrim) {
			handleCloseVideoSettings();
			return;
		}

		// Check if settings actually changed from current values — skip processing if identical
		const prevCrop = item.clip?.cropSettings;
		const prevTrim = item.clip?.trimSettings;
		const newCrop = settings.cropSettings;
		const newTrim = settings.trimSettings;
		const cropUnchanged =
			prevCrop &&
			newCrop &&
			Math.abs(prevCrop.x - newCrop.x) < 0.01 &&
			Math.abs(prevCrop.y - newCrop.y) < 0.01 &&
			Math.abs(prevCrop.width - newCrop.width) < 0.01 &&
			Math.abs(prevCrop.height - newCrop.height) < 0.01 &&
			prevCrop.aspect === newCrop.aspect;
		const trimUnchanged =
			(!prevTrim && !newTrim) ||
			(prevTrim &&
				newTrim &&
				Math.abs(prevTrim.startTime - newTrim.startTime) < 0.01 &&
				Math.abs(prevTrim.endTime - newTrim.endTime) < 0.01);

		if (cropUnchanged && trimUnchanged) {
			handleCloseVideoSettings();
			return;
		}

		// Check if block needs to be saved first
		const isNewBlock = selectedBlockId.startsWith("temp-");
		let blockIdToProcess: number;

		if (isNewBlock) {
			// Save the block first, then trigger video processing
			try {
				toast.info("Saving block before processing...");

				// Find the block's position
				const blockIndex = blocks.findIndex((b) => b.id === selectedBlockId);

				// Serialize to DB format
				const contentItems = newContent
					.filter((contentItem): contentItem is BlockContentItem => contentItem !== null)
					.map((contentItem) => ({
						...(contentItem.workId && { workId: contentItem.workId }),
						...(contentItem.animationId && { animationId: contentItem.animationId }),
						displayMode: contentItem.displayMode || "video",
						cropSettings: contentItem.clip?.cropSettings || undefined,
						trimSettings: contentItem.clip?.trimSettings || undefined,
						processedVideo: contentItem.clip?.status
							? {
									status: contentItem.clip.status,
									...(contentItem.clip.videoUrl && { url: contentItem.clip.videoUrl }),
									...(contentItem.clip.thumbnailUrl && { thumbnailUrl: contentItem.clip.thumbnailUrl }),
									...(contentItem.clip.error && { error: contentItem.clip.error }),
								}
							: undefined,
					}));

				const savedBlock = await blocksService.createBlock({
					modelName,
					modelId,
					type: block.type as any,
					content: { items: contentItems },
					position: blockIndex,
				});

				// Update the local state with the new real ID
				setBlocks(
					blocks.map((b) =>
						b.id === selectedBlockId ? { ...b, id: savedBlock.id.toString(), content: newContent } : b,
					),
				);
				setOriginalBlockIds([...originalBlockIds, savedBlock.id.toString()]);

				blockIdToProcess = savedBlock.id;
				toast.success("Block saved!");
			} catch (error: any) {
				console.error("Failed to save block:", error);
				toast.error("Failed to save block. Processing cancelled.");
				handleCloseVideoSettings();
				return;
			}
		} else {
			blockIdToProcess = parseInt(selectedBlockId);
		}

		// Now trigger processing
		try {
			toast.info(isThumbnailMode ? "Starting thumbnail generation..." : "Starting video processing...");

			// Immediately update UI to show processing state
			setBlocks((prevBlocks) =>
				prevBlocks.map((b) => {
					if (
						b.id !== (isNewBlock ? blocks.find((blk) => blk.id === selectedBlockId)?.id : selectedBlockId) &&
						b.id !== blockIdToProcess.toString()
					) {
						return b;
					}
					const updatedContent = [...b.content];
					if (updatedContent[selectedSlotIndex]) {
						updatedContent[selectedSlotIndex] = {
							...updatedContent[selectedSlotIndex]!,
							clip: {
								...updatedContent[selectedSlotIndex]!.clip,
								videoUrl: updatedContent[selectedSlotIndex]!.clip?.videoUrl || null,
								thumbnailUrl: updatedContent[selectedSlotIndex]!.clip?.thumbnailUrl || null,
								status: "processing",
								error: null,
								cropSettings: settings.cropSettings || updatedContent[selectedSlotIndex]!.clip?.cropSettings || null,
								trimSettings: settings.trimSettings || updatedContent[selectedSlotIndex]!.clip?.trimSettings || null,
							},
						};
					}
					return { ...b, content: updatedContent };
				}),
			);

			// Get the entity ID from the slot content
			const slotContent = block.content[selectedSlotIndex];
			const workIdForSlot = slotContent?.workId;
			const animationIdForSlot = slotContent?.animationId;

			const result = await blocksService.processVideo(blockIdToProcess, selectedSlotIndex, {
				...settings,
				...(workIdForSlot && { workId: workIdForSlot }),
				...(animationIdForSlot && { animationId: animationIdForSlot }),
				mode: isThumbnailMode ? "thumbnail" : "clip",
			});
			toast.success(
				isThumbnailMode
					? `Thumbnail generation started (Job ID: ${result.jobId.substring(0, 8)}...)`
					: `Video processing started (Job ID: ${result.jobId.substring(0, 8)}...)`,
			);
		} catch (error: any) {
			console.error("Failed to start processing:", error);
			const message =
				error?.response?.data?.message || error?.response?.data?.error || error?.message || "Unknown error";
			toast.error(`Processing failed: ${message}`);

			// Revert processing state on error
			setBlocks((prevBlocks) =>
				prevBlocks.map((b) => {
					if (b.id !== selectedBlockId && b.id !== blockIdToProcess.toString()) return b;
					const updatedContent = [...b.content];
					if (updatedContent[selectedSlotIndex]) {
						updatedContent[selectedSlotIndex] = {
							...updatedContent[selectedSlotIndex]!,
							clip: undefined,
						};
					}
					return { ...b, content: updatedContent };
				}),
			);
		}

		handleCloseVideoSettings();
	};

	// Handle close
	const handleClose = () => {
		closeBlockEditor();
	};

	// Handle retrying a failed clip
	const handleRetryClip = (blockId: string, slotIndex: number) => {
		handleOpenVideoSettings(blockId, slotIndex);
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={handleClose}>
				<DialogContent className="flex flex-col h-[90vh] max-w-6xl p-0 gap-0">
					{/* Header */}
					<DialogHeader className="px-6 py-4 border-b flex-none">
						<div className="flex items-center justify-between">
							<DialogTitle>{title ? `${title} — Block Editor` : "Block Editor"}</DialogTitle>
							<div className="flex items-center gap-2">
								<Button
									variant={previewMode ? "secondary" : "outline"}
									size="sm"
									onClick={() => setPreviewMode(!previewMode)}
								>
									{previewMode ? (
										<>
											<IconEdit className="w-4 h-4 mr-1" />
											Edit
										</>
									) : (
										<>
											<IconEye className="w-4 h-4 mr-1" />
											Preview
										</>
									)}
								</Button>
								<Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
									<IconX className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</DialogHeader>

					{/* Content */}
					<div className="flex flex-1 min-h-0 overflow-hidden">
						{/* Left Panel - Block Palette */}
						{!previewMode && (
							<div className="w-56 border-r p-4 overflow-y-auto">
								<BlockPalette onAddBlock={handleAddBlock} />
							</div>
						)}

						{/* Main Panel - Block Canvas */}
						<div className="flex-1 overflow-y-auto p-4">
							{isLoading ? (
								<div className="flex items-center justify-center h-full">
									<div className="text-muted-foreground">Loading blocks...</div>
								</div>
							) : blocks.length === 0 ? (
								<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
									<IconPlus className="w-12 h-12 mb-4 opacity-50" />
									<p className="text-lg font-medium mb-2">No blocks yet</p>
									<p className="text-sm">Add a block from the palette to get started</p>
								</div>
							) : previewMode ? (
								// Preview Mode
								<div>
									{blocks.map((block) => (
										<PreviewBlock key={block.id} block={block} />
									))}
								</div>
							) : (
								// Edit Mode - Sortable
								<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
									<SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
										{blocks.map((block) => (
											<SortableBlockItem
												key={block.id}
												block={block}
												onDelete={() => handleDeleteBlock(block.id)}
												onSlotClick={(slotIndex) => handleSlotClick(block.id, slotIndex)}
												onVideoSettings={(slotIndex) => handleOpenVideoSettings(block.id, slotIndex)}
												onMoveSlot={(fromIndex, toIndex) => handleMoveSlot(block.id, fromIndex, toIndex)}
												onToggleDisplayMode={(slotIndex) => handleToggleDisplayMode(block.id, slotIndex)}
												onRetryClip={(slotIndex) => handleRetryClip(block.id, slotIndex)}
											/>
										))}
									</SortableContext>
								</DndContext>
							)}
						</div>
					</div>

					{/* Footer */}
					<div className="px-6 py-4 border-t bg-muted/50 flex justify-between items-center">
						<div className="text-sm text-muted-foreground">
							{blocks.length} block{blocks.length !== 1 ? "s" : ""}
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button onClick={handleSave} disabled={saveMutation.isPending}>
								{saveMutation.isPending ? "Saving..." : "Save"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Video Settings Modal */}
			{isVideoSettingsOpen && videoSettingsData && (
				<VideoSettingsModal
					mediaUrl={videoSettingsData.mediaUrl}
					cropSettings={videoSettingsData.cropSettings || undefined}
					trimSettings={videoSettingsData.trimSettings || undefined}
					mode={videoSettingsData.mode}
					sourceMediaId={videoSettingsData.sourceMediaId}
					onCancel={handleCloseVideoSettings}
					onSave={handleSaveVideoSettings}
					onSelectExistingClip={(clip) => {
						if (!selectedBlockId || selectedSlotIndex === null) return;
						const block = blocks.find((b) => b.id === selectedBlockId);
						if (!block) return;
						const newContent = [...block.content];
						const item = newContent[selectedSlotIndex];
						if (!item) return;
						newContent[selectedSlotIndex] = {
							...item,
							clip: {
								videoUrl: clip.outputUrl || null,
								thumbnailUrl: clip.thumbnailUrl || null,
								status: "completed",
								error: null,
								cropSettings: clip.cropSettings as CropSettings | null,
								trimSettings: clip.trimSettings as TrimSettings | null,
							},
						};
						handleUpdateBlock(selectedBlockId, { content: newContent });
						handleCloseVideoSettings();
					}}
				/>
			)}

			{/* Content Selector Modal */}
			<Dialog open={isContentSelectorOpen} onOpenChange={setIsContentSelectorOpen}>
				<DialogContent className="max-w-2xl flex flex-col">
					<DialogHeader>
						<DialogTitle>Select Content</DialogTitle>
						<DialogDescription>
							{isAnimationsMode
								? "Choose an animation or select media directly"
								: "Choose a work or select media directly"}
						</DialogDescription>
					</DialogHeader>

					{/* Search */}
					<div className="flex gap-2 mb-4">
						<Input
							placeholder={isAnimationsMode ? "Search animations..." : "Search works..."}
							value={workSearchQuery}
							onChange={(e) => setWorkSearchQuery(e.target.value)}
							className="flex-1"
						/>
						<Button variant="outline" onClick={handleOpenMediaLibrary}>
							<IconPhoto className="w-4 h-4 mr-2" />
							Media Library
						</Button>
					</div>

					{/* Entity List */}
					<div className="h-[400px] border rounded-md overflow-y-auto" onScroll={handleWorksScroll}>
						<div className="p-2 space-y-1">
							{isEntitiesLoading ? (
								<div className="text-center text-muted-foreground py-8">Loading...</div>
							) : allEntities.length === 0 ? (
								<div className="text-center text-muted-foreground py-8">
									{workSearchQuery
										? `No ${isAnimationsMode ? "animations" : "works"} found`
										: `No ${isAnimationsMode ? "animations" : "works"} available`}
								</div>
							) : (
								<>
									{allEntities.map((entity: any) => (
										<button
											key={entity.id}
											onClick={() =>
												isAnimationsMode
													? handleAnimationSelected(entity as Animation)
													: handleWorkSelected(entity as Work)
											}
											className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
										>
											{/* Thumbnail */}
											<div className="w-24 h-14 bg-muted rounded overflow-hidden shrink-0">
												{entity.previewImage?.images?.thumbnail || entity.videoFile?.images?.thumbnail ? (
													<img
														src={entity.previewImage?.images?.thumbnail || entity.videoFile?.images?.thumbnail}
														alt=""
														className="w-full h-full object-cover"
														loading="lazy"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center">
														<IconMovie className="w-6 h-6 text-muted-foreground" />
													</div>
												)}
											</div>
											{/* Info */}
											<div className="flex-1 min-w-0">
												<div className="font-medium truncate">{entity.title}</div>
												<div className="text-sm text-muted-foreground truncate">{entity.client}</div>
											</div>
											{/* Video indicator */}
											{entity.videoFile && <IconVideo className="w-4 h-4 text-muted-foreground shrink-0" />}
										</button>
									))}
									{isFetchingNextPage && (
										<div className="text-center text-muted-foreground py-4 text-sm">Loading more...</div>
									)}
								</>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

// Preview Block Component
function PreviewBlock({ block }: { block: Block }) {
	const gridClass = {
		ONE_COLUMN: "grid-cols-1",
		TWO_COLUMN: "grid-cols-2",
		THREE_COLUMN: "grid-cols-3",
		FOUR_COLUMN: "grid-cols-4",
		ONE_TWO: "grid-cols-3",
		TWO_ONE: "grid-cols-3",
	}[block.type];

	return (
		<div className={`grid ${gridClass} items-start`}>
			{block.content.map((item, slotIndex) => {
				if (!item) return <div key={slotIndex} className="bg-muted rounded-md" />;

				const entity = getEntity(item);
				if (!entity) return <div key={slotIndex} className="bg-muted rounded-md" />;

				let spanClass = "";
				if (block.type === "ONE_TWO") {
					spanClass = slotIndex === 0 ? "col-span-1" : "col-span-2";
				} else if (block.type === "TWO_ONE") {
					spanClass = slotIndex === 0 ? "col-span-2" : "col-span-1";
				}

				return (
					<div key={slotIndex} className={`overflow-hidden ${spanClass}`}>
						{item.displayMode === "thumbnail" ? (
							<img src={entity.thumbnailUrl || ""} alt="" className="w-full h-full object-cover" />
						) : item.clip?.status === "completed" && item.clip?.videoUrl ? (
							<video
								src={item.clip.videoUrl}
								poster={entity.thumbnailUrl || ""}
								className="w-full h-full object-cover"
								muted
								playsInline
								loop
								autoPlay
							/>
						) : (
							<img src={entity.thumbnailUrl || ""} alt="" className="w-full h-full object-cover" />
						)}
					</div>
				);
			})}
		</div>
	);
}
