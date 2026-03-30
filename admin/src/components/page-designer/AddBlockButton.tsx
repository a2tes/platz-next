"use client";

import * as React from "react";
import {
	IconPlus,
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
import type { DesignerBlockType, DesignerElementBlockType, DesignerLayoutBlockType } from "./types";
import { ELEMENT_BLOCK_TYPE_CONFIGS, LAYOUT_BLOCK_TYPE_CONFIGS } from "./types";

const ELEMENT_ICONS: Record<DesignerElementBlockType, React.ReactNode> = {
	HEADING: <IconH1 className="w-5 h-5" />,
	PARAGRAPH: <IconAlignLeft className="w-5 h-5" />,
	QUOTE: <IconQuote className="w-5 h-5" />,
	MEDIA: <IconPhoto className="w-5 h-5" />,
	SPACER: <IconSpacingVertical className="w-5 h-5" />,
	DIVIDER: <IconMinus className="w-5 h-5" />,
	EMBED: <IconBrandYoutube className="w-5 h-5" />,
	CODE_BLOCK: <IconCode className="w-5 h-5" />,
};

const LAYOUT_ICONS: Record<DesignerLayoutBlockType, React.ReactNode> = {
	ONE_COLUMN: <IconSquareNumber1 className="w-5 h-5" />,
	TWO_COLUMN: <IconSquareNumber2 className="w-5 h-5" />,
	THREE_COLUMN: <IconSquareNumber3 className="w-5 h-5" />,
	FOUR_COLUMN: <IconSquareNumber4 className="w-5 h-5" />,
	ONE_TWO: <IconLayoutSidebar className="w-5 h-5" />,
	TWO_ONE: <IconLayoutSidebarRight className="w-5 h-5" />,
};

interface AddBlockButtonProps {
	position: number;
	onAdd: (type: DesignerBlockType, position: number) => void;
	variant?: "between" | "bottom";
}

export function AddBlockButton({ position, onAdd, variant = "between" }: AddBlockButtonProps) {
	const [open, setOpen] = React.useState(false);

	const handleSelect = (type: DesignerBlockType) => {
		onAdd(type, position);
		setOpen(false);
	};

	if (variant === "bottom") {
		return (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="w-full py-3 border-2 border-dashed border-muted-foreground/20 rounded-lg text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm"
					>
						<IconPlus className="w-4 h-4" />
						Add Block
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-80 p-2" align="center">
					<BlockTypeGrid onSelect={handleSelect} />
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<div className="relative h-0 my-1 group/add">
			{/* Hover line */}
			<div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-transparent group-hover/add:bg-primary/30 transition-colors" />

			{/* Add button */}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-muted-foreground/20 hover:border-primary hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all opacity-0 group-hover/add:opacity-100 flex items-center justify-center z-10"
					>
						<IconPlus className="w-3.5 h-3.5" />
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-80 p-2" align="center">
					<BlockTypeGrid onSelect={handleSelect} />
				</PopoverContent>
			</Popover>
		</div>
	);
}

function BlockTypeGrid({ onSelect }: { onSelect: (type: DesignerBlockType) => void }) {
	return (
		<div className="space-y-3">
			{/* Blocks (Layout) */}
			<div>
				<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Blocks</p>
				<div className="grid grid-cols-3 gap-1">
					{LAYOUT_BLOCK_TYPE_CONFIGS.map((config) => (
						<button
							key={config.type}
							type="button"
							onClick={() => onSelect(config.type)}
							className="flex flex-col items-center gap-1.5 p-2.5 rounded-md hover:bg-accent transition-colors group/item"
						>
							<span className="text-muted-foreground group-hover/item:text-foreground transition-colors">
								{LAYOUT_ICONS[config.type]}
							</span>
							<span className="text-[10px] text-muted-foreground group-hover/item:text-foreground transition-colors leading-tight text-center">
								{config.label}
							</span>
						</button>
					))}
				</div>
			</div>

			{/* Elements */}
			<div>
				<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Elements</p>
				<div className="grid grid-cols-4 gap-1">
					{ELEMENT_BLOCK_TYPE_CONFIGS.map((config) => (
						<button
							key={config.type}
							type="button"
							onClick={() => onSelect(config.type)}
							className="flex flex-col items-center gap-1.5 p-2.5 rounded-md hover:bg-accent transition-colors group/item"
						>
							<span className="text-muted-foreground group-hover/item:text-foreground transition-colors">
								{ELEMENT_ICONS[config.type]}
							</span>
							<span className="text-[10px] text-muted-foreground group-hover/item:text-foreground transition-colors leading-tight text-center">
								{config.label}
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
