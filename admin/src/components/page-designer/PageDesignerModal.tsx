"use client";

import * as React from "react";
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
	DragOverlay,
	useDraggable,
	useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
	IconH1,
	IconAlignLeft,
	IconQuote,
	IconPhoto,
	IconSpacingVertical,
	IconMinus,
	IconBrandYoutube,
	IconCode,
	IconX,
	IconEye,
	IconEdit,
	IconLayoutDashboard,
	IconSquareNumber1,
	IconSquareNumber2,
	IconSquareNumber3,
	IconSquareNumber4,
	IconLayoutSidebar,
	IconLayoutSidebarRight,
} from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePageDesignerStore } from "@/stores/pageDesignerStore";
import { PageDesignerBlock } from "./PageDesignerBlock";
import { AddBlockButton } from "./AddBlockButton";
import type { DesignerBlockType, DesignerElementBlockType, DesignerLayoutBlockType, SlotChildBlock } from "./types";
import { ELEMENT_BLOCK_TYPE_CONFIGS, LAYOUT_BLOCK_TYPE_CONFIGS, isLayoutBlockType } from "./types";
import { toast } from "sonner";

const ELEMENT_SIDEBAR_ICONS: Record<DesignerElementBlockType, React.ReactNode> = {
	HEADING: <IconH1 className="w-5 h-5" />,
	PARAGRAPH: <IconAlignLeft className="w-5 h-5" />,
	QUOTE: <IconQuote className="w-5 h-5" />,
	MEDIA: <IconPhoto className="w-5 h-5" />,
	SPACER: <IconSpacingVertical className="w-5 h-5" />,
	DIVIDER: <IconMinus className="w-5 h-5" />,
	EMBED: <IconBrandYoutube className="w-5 h-5" />,
	CODE_BLOCK: <IconCode className="w-5 h-5" />,
};

const LAYOUT_SIDEBAR_ICONS: Record<DesignerLayoutBlockType, React.ReactNode> = {
	ONE_COLUMN: <IconSquareNumber1 className="w-5 h-5" />,
	TWO_COLUMN: <IconSquareNumber2 className="w-5 h-5" />,
	THREE_COLUMN: <IconSquareNumber3 className="w-5 h-5" />,
	FOUR_COLUMN: <IconSquareNumber4 className="w-5 h-5" />,
	ONE_TWO: <IconLayoutSidebar className="w-5 h-5" />,
	TWO_ONE: <IconLayoutSidebarRight className="w-5 h-5" />,
};

const ALL_LABELS: Record<DesignerBlockType, string> = {
	HEADING: "Heading",
	PARAGRAPH: "Paragraph",
	QUOTE: "Quote",
	MEDIA: "Image / Video",
	SPACER: "Spacer",
	DIVIDER: "Divider",
	EMBED: "Embed",
	CODE_BLOCK: "Code",
	ONE_COLUMN: "1 Column",
	TWO_COLUMN: "2 Columns",
	THREE_COLUMN: "3 Columns",
	FOUR_COLUMN: "4 Columns",
	ONE_TWO: "1:2 Split",
	TWO_ONE: "2:1 Split",
};

const ALL_ICONS: Record<DesignerBlockType, React.ReactNode> = {
	...ELEMENT_SIDEBAR_ICONS,
	...LAYOUT_SIDEBAR_ICONS,
};

const SIDEBAR_DRAG_PREFIX = "sidebar-";

/* ─── Draggable sidebar item ─── */
function DraggableSidebarItem({ type, children }: { type: DesignerBlockType; children: React.ReactNode }) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `${SIDEBAR_DRAG_PREFIX}${type}`,
	});
	return (
		<div
			ref={setNodeRef}
			{...listeners}
			{...attributes}
			className={`flex flex-col items-center justify-center p-3 border rounded-lg hover:bg-accent transition-colors group cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
		>
			{children}
		</div>
	);
}

/* ─── Droppable canvas wrapper ─── */
function DroppableCanvas({ children }: { children: React.ReactNode }) {
	const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });
	return (
		<div ref={setNodeRef} className={`flex-1 overflow-y-auto p-6 transition-colors ${isOver ? "bg-primary/5" : ""}`}>
			{children}
		</div>
	);
}

interface PageDesignerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	modelName: string;
	modelId: number | null;
	title?: string;
}

export function PageDesignerModal({ open, onOpenChange, modelName, modelId, title }: PageDesignerModalProps) {
	const {
		blocks,
		activeBlockId,
		isDirty,
		isLoading,
		addBlock,
		updateBlockContent,
		deleteBlock,
		moveBlock,
		setActiveBlock,
		loadBlocks,
		saveBlocks,
		reset,
	} = usePageDesignerStore();

	const [previewMode, setPreviewMode] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);
	const [draggingType, setDraggingType] = React.useState<DesignerBlockType | null>(null);

	// Load blocks when modal opens
	React.useEffect(() => {
		if (open && modelId) {
			loadBlocks(modelName, modelId);
		} else if (open && !modelId) {
			reset();
		}
	}, [open, modelName, modelId, loadBlocks, reset]);

	// DnD sensors
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const handleDragStart = (event: DragStartEvent) => {
		const id = String(event.active.id);
		if (id.startsWith(SIDEBAR_DRAG_PREFIX)) {
			const blockType = id.slice(SIDEBAR_DRAG_PREFIX.length) as DesignerBlockType;
			setDraggingType(blockType);
		}
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		setDraggingType(null);

		if (!over) return;

		const activeId = String(active.id);

		// Sidebar drag → canvas drop
		if (activeId.startsWith(SIDEBAR_DRAG_PREFIX)) {
			const blockType = activeId.slice(SIDEBAR_DRAG_PREFIX.length) as DesignerBlockType;
			const overId = String(over.id);

			if (overId === "canvas-drop") {
				// Drop at end
				addBlock(blockType);
			} else {
				// Drop next to an existing block
				const overIndex = blocks.findIndex((b) => b.id === overId);
				if (overIndex !== -1) {
					addBlock(blockType, overIndex + 1);
				} else {
					addBlock(blockType);
				}
			}
			return;
		}

		// Reorder existing blocks
		if (active.id !== over.id) {
			const oldIndex = blocks.findIndex((b) => b.id === active.id);
			const newIndex = blocks.findIndex((b) => b.id === over.id);
			if (oldIndex !== -1 && newIndex !== -1) {
				moveBlock(oldIndex, newIndex);
			}
		}
	};

	const handleAddBlock = (type: DesignerBlockType, position: number) => {
		addBlock(type, position);
	};

	const handleDuplicate = (blockId: string) => {
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return;
		const position = blocks.findIndex((b) => b.id === blockId) + 1;
		addBlock(block.type, position);
		const newBlock = usePageDesignerStore.getState().blocks[position];
		if (newBlock) {
			updateBlockContent(newBlock.id, { ...block.content });
		}
	};

	const handleSave = async () => {
		if (!modelId) {
			toast.info("Page content will be saved when you save the work.");
			onOpenChange(false);
			return;
		}
		setIsSaving(true);
		try {
			await saveBlocks(modelName, modelId);
			toast.success("Page content saved");
		} catch {
			toast.error("Failed to save page content");
		} finally {
			setIsSaving(false);
		}
	};

	const handleClose = () => {
		if (isDirty && modelId) {
			const confirmed = window.confirm("You have unsaved changes. Are you sure you want to close?");
			if (!confirmed) return;
		}
		setPreviewMode(false);
		if (modelId) {
			reset();
		}
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="flex flex-col max-h-dvh h-dvw max-w-full rounded-none w-full p-0 gap-0">
				{/* Header */}
				<DialogHeader className="px-6 py-4 border-b flex-none">
					<div className="flex items-center justify-between">
						<DialogTitle>{title ? `${title} — Page Designer` : "Page Designer"}</DialogTitle>
						<div className="flex items-center gap-2">
							<Button
								variant={previewMode ? "secondary" : "outline"}
								size="sm"
								onClick={() => setPreviewMode(!previewMode)}
							>
								{previewMode ? (
									<>
										<IconEdit className="w-4 h-4 mr-1" /> Edit
									</>
								) : (
									<>
										<IconEye className="w-4 h-4 mr-1" /> Preview
									</>
								)}
							</Button>
							<Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
								<IconX className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</DialogHeader>

				{/* Content - Two column layout */}
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					<div className="flex flex-1 min-h-0 overflow-hidden">
						{/* Left Sidebar - Block Palette */}
						{!previewMode && (
							<div className="w-56 border-r p-3 overflow-y-auto bg-muted/20">
								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Blocks</p>
								<div className="grid grid-cols-2 gap-2 mb-5">
									{LAYOUT_BLOCK_TYPE_CONFIGS.map((config) => (
										<DraggableSidebarItem key={config.type} type={config.type}>
											<span className="text-muted-foreground group-hover:text-foreground transition-colors">
												{LAYOUT_SIDEBAR_ICONS[config.type]}
											</span>
											<span className="text-xs mt-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
												{config.label}
											</span>
										</DraggableSidebarItem>
									))}
								</div>

								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
									Elements
								</p>
								<div className="grid grid-cols-2 gap-2">
									{ELEMENT_BLOCK_TYPE_CONFIGS.map((config) => (
										<DraggableSidebarItem key={config.type} type={config.type}>
											<span className="text-muted-foreground group-hover:text-foreground transition-colors">
												{ELEMENT_SIDEBAR_ICONS[config.type]}
											</span>
											<span className="text-xs mt-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
												{config.label}
											</span>
										</DraggableSidebarItem>
									))}
								</div>
							</div>
						)}

						{/* Main Canvas */}
						<DroppableCanvas>
							{isLoading ? (
								<div className="flex items-center justify-center h-full">
									<div className="text-muted-foreground flex items-center gap-2">
										<div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
										Loading blocks...
									</div>
								</div>
							) : blocks.length === 0 ? (
								<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
									<IconLayoutDashboard className="w-12 h-12 mb-4 opacity-40" />
									<p className="text-lg font-medium mb-2">No content yet</p>
									<p className="text-sm mb-6">Drag blocks from the sidebar or click to add</p>
									{!previewMode && <AddBlockButton position={0} onAdd={handleAddBlock} variant="bottom" />}
								</div>
							) : previewMode ? (
								/* Preview Mode */
								<div className="max-w-full mx-auto space-y-4">
									{blocks.map((block) => (
										<PreviewBlockContent key={block.id} block={block} />
									))}
								</div>
							) : (
								/* Edit Mode */
								<div className="max-w-3xl mx-auto">
									<SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
										{blocks.map((block, index) => (
											<React.Fragment key={block.id}>
												{index === 0 && <AddBlockButton position={0} onAdd={handleAddBlock} />}
												<PageDesignerBlock
													block={block}
													isActive={activeBlockId === block.id}
													onUpdate={(content) => updateBlockContent(block.id, content)}
													onDelete={() => deleteBlock(block.id)}
													onDuplicate={() => handleDuplicate(block.id)}
													onFocus={() => setActiveBlock(block.id)}
												/>
												<AddBlockButton position={index + 1} onAdd={handleAddBlock} />
											</React.Fragment>
										))}
									</SortableContext>
									<AddBlockButton position={blocks.length} onAdd={handleAddBlock} variant="bottom" />
								</div>
							)}
						</DroppableCanvas>
					</div>

					{/* Drag Overlay */}
					<DragOverlay>
						{draggingType ? (
							<div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg shadow-lg">
								{ALL_ICONS[draggingType]}
								<span className="text-sm font-medium">{ALL_LABELS[draggingType]}</span>
							</div>
						) : null}
					</DragOverlay>
				</DndContext>

				{/* Footer */}
				<div className="px-6 py-4 border-t bg-muted/50 flex justify-between items-center flex-none">
					<div className="text-sm text-muted-foreground">
						{blocks.length} block{blocks.length !== 1 ? "s" : ""}
						{isDirty && <span className="text-amber-600 ml-2">• Unsaved changes</span>}
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={isSaving || !isDirty}>
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/* ─── Preview Block (read-only rendering) ─── */

function PreviewBlockContent({ block }: { block: { type: DesignerBlockType; content: Record<string, unknown> } }) {
	const { type, content } = block;

	// Layout blocks
	if (isLayoutBlockType(type)) {
		return <PreviewLayoutBlock layoutType={type} content={content} />;
	}

	switch (type) {
		case "HEADING": {
			const level = (content.level as number) || 2;
			const text = (content.text as string) || "";
			if (!text) return null;
			const sizes: Record<number, string> = {
				1: "text-4xl font-bold",
				2: "text-3xl font-bold",
				3: "text-2xl font-semibold",
				4: "text-xl font-semibold",
			};
			const cls = sizes[level] || sizes[2];
			if (level === 1) return <h1 className={cls}>{text}</h1>;
			if (level === 3) return <h3 className={cls}>{text}</h3>;
			if (level === 4) return <h4 className={cls}>{text}</h4>;
			return <h2 className={cls}>{text}</h2>;
		}
		case "PARAGRAPH": {
			const html = (content.html as string) || "";
			if (!html) return null;
			return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
		}
		case "QUOTE": {
			const text = (content.text as string) || "";
			const citation = (content.citation as string) || "";
			if (!text) return null;
			return (
				<blockquote className="border-l-4 border-primary/30 pl-4 italic text-lg text-foreground/80">
					<p>{text}</p>
					{citation && <footer className="text-sm text-muted-foreground mt-2">{citation}</footer>}
				</blockquote>
			);
		}
		case "MEDIA": {
			const url = content.url as string | null;
			const caption = (content.caption as string) || "";
			if (!url) return null;
			return (
				<figure>
					<img src={url} alt={(content.alt as string) || ""} className="rounded-lg w-full" />
					{caption && <figcaption className="text-sm text-muted-foreground text-center mt-2">{caption}</figcaption>}
				</figure>
			);
		}
		case "DIVIDER":
			return <hr className="border-t border-border" style={{ borderStyle: (content.style as string) || "solid" }} />;
		case "SPACER":
			return <div style={{ height: `${(content.height as number) || 48}px` }} />;
		case "EMBED": {
			const url = (content.url as string) || "";
			const caption = (content.caption as string) || "";
			if (!url) return null;
			return (
				<figure>
					<div className="aspect-video rounded-lg overflow-hidden bg-black">
						<iframe src={url} className="w-full h-full" allowFullScreen title="Embed" />
					</div>
					{caption && <figcaption className="text-sm text-muted-foreground text-center mt-2">{caption}</figcaption>}
				</figure>
			);
		}
		case "CODE_BLOCK": {
			const code = (content.code as string) || "";
			if (!code) return null;
			return (
				<pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-x-auto text-sm font-mono">
					<code>{code}</code>
				</pre>
			);
		}
		default:
			return null;
	}
}

/* ─── Preview Layout Block (read-only column rendering) ─── */

const PREVIEW_GRID_CLASSES: Record<DesignerLayoutBlockType, string> = {
	ONE_COLUMN: "grid-cols-1",
	TWO_COLUMN: "grid-cols-2",
	THREE_COLUMN: "grid-cols-3",
	FOUR_COLUMN: "grid-cols-4",
	ONE_TWO: "grid-cols-3",
	TWO_ONE: "grid-cols-3",
};

const PREVIEW_SPAN_FN: Record<DesignerLayoutBlockType, (i: number) => string> = {
	ONE_COLUMN: () => "",
	TWO_COLUMN: () => "",
	THREE_COLUMN: () => "",
	FOUR_COLUMN: () => "",
	ONE_TWO: (i) => (i === 0 ? "col-span-1" : "col-span-2"),
	TWO_ONE: (i) => (i === 0 ? "col-span-2" : "col-span-1"),
};

function PreviewLayoutBlock({
	layoutType,
	content,
}: {
	layoutType: DesignerLayoutBlockType;
	content: Record<string, unknown>;
}) {
	const slots = (content.slots as SlotChildBlock[][] | undefined) || [];
	const gridClass = PREVIEW_GRID_CLASSES[layoutType];
	const getSpan = PREVIEW_SPAN_FN[layoutType];

	return (
		<div className={`grid ${gridClass} gap-4`}>
			{slots.map((slot, slotIndex) => (
				<div key={slotIndex} className={`${getSpan(slotIndex)} space-y-4`}>
					{slot.map((child) => (
						<PreviewBlockContent key={child.id} block={{ type: child.type, content: child.content }} />
					))}
				</div>
			))}
		</div>
	);
}
