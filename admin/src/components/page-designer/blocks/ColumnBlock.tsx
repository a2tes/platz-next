"use client";

import * as React from "react";
import {
	IconPlus,
	IconTrash,
	IconH1,
	IconAlignLeft,
	IconQuote,
	IconPhoto,
	IconSpacingVertical,
	IconMinus,
	IconBrandYoutube,
	IconCode,
	IconSquareNumber1,
	IconSquareNumber2,
	IconSquareNumber3,
	IconSquareNumber4,
	IconLayoutSidebar,
	IconLayoutSidebarRight,
} from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
	DesignerBlockType,
	DesignerLayoutBlockType,
	DesignerElementBlockType,
	SlotChildBlock,
	BlockComponentProps,
} from "../types";
import {
	ELEMENT_BLOCK_TYPE_CONFIGS,
	LAYOUT_BLOCK_TYPE_CONFIGS,
	isLayoutBlockType,
	generateId,
	getDefaultContent,
} from "../types";
import {
	HeadingBlock,
	ParagraphBlock,
	QuoteBlock,
	MediaBlock,
	SpacerBlock,
	DividerBlock,
	EmbedBlock,
	CodeBlock,
} from "./index";

const GRID_CLASSES: Record<DesignerLayoutBlockType, string> = {
	ONE_COLUMN: "grid-cols-1",
	TWO_COLUMN: "grid-cols-2",
	THREE_COLUMN: "grid-cols-3",
	FOUR_COLUMN: "grid-cols-4",
	ONE_TWO: "grid-cols-3",
	TWO_ONE: "grid-cols-3",
};

const SPAN_FN: Record<DesignerLayoutBlockType, (i: number) => string> = {
	ONE_COLUMN: () => "",
	TWO_COLUMN: () => "",
	THREE_COLUMN: () => "",
	FOUR_COLUMN: () => "",
	ONE_TWO: (i) => (i === 0 ? "col-span-1" : "col-span-2"),
	TWO_ONE: (i) => (i === 0 ? "col-span-2" : "col-span-1"),
};

const ELEMENT_COMPONENTS: Record<DesignerElementBlockType, React.FC<BlockComponentProps>> = {
	HEADING: HeadingBlock,
	PARAGRAPH: ParagraphBlock,
	QUOTE: QuoteBlock,
	MEDIA: MediaBlock,
	SPACER: SpacerBlock,
	DIVIDER: DividerBlock,
	EMBED: EmbedBlock,
	CODE_BLOCK: CodeBlock,
};

const ALL_ICONS: Record<DesignerBlockType, React.ReactNode> = {
	HEADING: <IconH1 className="w-4 h-4" />,
	PARAGRAPH: <IconAlignLeft className="w-4 h-4" />,
	QUOTE: <IconQuote className="w-4 h-4" />,
	MEDIA: <IconPhoto className="w-4 h-4" />,
	SPACER: <IconSpacingVertical className="w-4 h-4" />,
	DIVIDER: <IconMinus className="w-4 h-4" />,
	EMBED: <IconBrandYoutube className="w-4 h-4" />,
	CODE_BLOCK: <IconCode className="w-4 h-4" />,
	ONE_COLUMN: <IconSquareNumber1 className="w-4 h-4" />,
	TWO_COLUMN: <IconSquareNumber2 className="w-4 h-4" />,
	THREE_COLUMN: <IconSquareNumber3 className="w-4 h-4" />,
	FOUR_COLUMN: <IconSquareNumber4 className="w-4 h-4" />,
	ONE_TWO: <IconLayoutSidebar className="w-4 h-4" />,
	TWO_ONE: <IconLayoutSidebarRight className="w-4 h-4" />,
};

interface ColumnBlockProps {
	layoutType: DesignerLayoutBlockType;
	content: Record<string, unknown>;
	onChange: (content: Record<string, unknown>) => void;
}

export function ColumnBlock({ layoutType, content, onChange }: ColumnBlockProps) {
	const slots = (content.slots as SlotChildBlock[][] | undefined) || [];
	const gridClass = GRID_CLASSES[layoutType];
	const getSpan = SPAN_FN[layoutType];

	const addChild = (slotIndex: number, type: DesignerBlockType) => {
		const newChild: SlotChildBlock = {
			id: generateId(),
			type,
			content: getDefaultContent(type),
			position: slots[slotIndex]?.length || 0,
		};

		const updatedSlots = slots.map((slot, i) => (i === slotIndex ? [...slot, newChild] : [...slot]));
		onChange({ ...content, slots: updatedSlots });
	};

	const updateChild = (slotIndex: number, childId: string, childContent: Record<string, unknown>) => {
		const updatedSlots = slots.map((slot, i) => {
			if (i !== slotIndex) return slot;
			return slot.map((child) =>
				child.id === childId ? { ...child, content: { ...child.content, ...childContent } } : child,
			);
		});
		onChange({ ...content, slots: updatedSlots });
	};

	const replaceChildContent = (slotIndex: number, childId: string, newContent: Record<string, unknown>) => {
		const updatedSlots = slots.map((slot, i) => {
			if (i !== slotIndex) return slot;
			return slot.map((child) => (child.id === childId ? { ...child, content: newContent } : child));
		});
		onChange({ ...content, slots: updatedSlots });
	};

	const deleteChild = (slotIndex: number, childId: string) => {
		const updatedSlots = slots.map((slot, i) => {
			if (i !== slotIndex) return slot;
			return slot.filter((child) => child.id !== childId).map((child, idx) => ({ ...child, position: idx }));
		});
		onChange({ ...content, slots: updatedSlots });
	};

	return (
		<div className={`grid ${gridClass} gap-3`}>
			{slots.map((slot, slotIndex) => (
				<div
					key={slotIndex}
					className={`${getSpan(slotIndex)} min-h-20 border border-dashed border-border/50 rounded-md p-2`}
				>
					{/* Child blocks */}
					{slot.map((child) => {
						if (isLayoutBlockType(child.type)) {
							return (
								<div key={child.id} className="relative group/child mb-2 last:mb-0">
									<button
										type="button"
										onClick={() => deleteChild(slotIndex, child.id)}
										className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover/child:opacity-100 transition-opacity z-10"
									>
										<IconTrash className="w-3 h-3" />
									</button>
									<ColumnBlock
										layoutType={child.type as DesignerLayoutBlockType}
										content={child.content}
										onChange={(newContent) => replaceChildContent(slotIndex, child.id, newContent)}
									/>
								</div>
							);
						}

						const Component = ELEMENT_COMPONENTS[child.type as DesignerElementBlockType];
						if (!Component) return null;
						return (
							<div key={child.id} className="relative group/child mb-2 last:mb-0">
								<button
									type="button"
									onClick={() => deleteChild(slotIndex, child.id)}
									className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover/child:opacity-100 transition-opacity z-10"
								>
									<IconTrash className="w-3 h-3" />
								</button>
								<Component
									content={child.content}
									onChange={(newContent) => updateChild(slotIndex, child.id, newContent)}
								/>
							</div>
						);
					})}

					{/* Add block/element button */}
					<AddSlotBlockButton onAdd={(type) => addChild(slotIndex, type)} />
				</div>
			))}
		</div>
	);
}

function AddSlotBlockButton({ onAdd }: { onAdd: (type: DesignerBlockType) => void }) {
	const [open, setOpen] = React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors flex items-center justify-center gap-1"
				>
					<IconPlus className="w-3 h-3" />
					Add
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-2" align="center">
				<div className="space-y-2">
					<div>
						<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">Blocks</p>
						<div className="grid grid-cols-3 gap-1">
							{LAYOUT_BLOCK_TYPE_CONFIGS.map((config) => (
								<button
									key={config.type}
									type="button"
									onClick={() => {
										onAdd(config.type);
										setOpen(false);
									}}
									className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent transition-colors group/item"
								>
									<span className="text-muted-foreground group-hover/item:text-foreground transition-colors">
										{ALL_ICONS[config.type]}
									</span>
									<span className="text-[10px] text-muted-foreground group-hover/item:text-foreground transition-colors leading-tight text-center">
										{config.label}
									</span>
								</button>
							))}
						</div>
					</div>
					<div>
						<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
							Elements
						</p>
						<div className="grid grid-cols-4 gap-1">
							{ELEMENT_BLOCK_TYPE_CONFIGS.map((config) => (
								<button
									key={config.type}
									type="button"
									onClick={() => {
										onAdd(config.type);
										setOpen(false);
									}}
									className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent transition-colors group/item"
								>
									<span className="text-muted-foreground group-hover/item:text-foreground transition-colors">
										{ALL_ICONS[config.type]}
									</span>
									<span className="text-[10px] text-muted-foreground group-hover/item:text-foreground transition-colors leading-tight text-center">
										{config.label}
									</span>
								</button>
							))}
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
