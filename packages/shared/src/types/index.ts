// Block Types
export type BlockType =
	| "ONE_COLUMN"
	| "TWO_COLUMN"
	| "THREE_COLUMN"
	| "FOUR_COLUMN"
	| "ONE_TWO"
	| "TWO_ONE"
	| "CUSTOM_COLUMN"
	| "PARAGRAPH"
	| "QUOTE"
	| "MEDIA"
	| "HEADING"
	| "SPACER"
	| "DIVIDER"
	| "EMBED"
	| "CODE_BLOCK";

export type BlockPageType = "WORKS";

export type BlockStatus = "DRAFT" | "PUBLISHED" | "UNLISTED";

// Block Content Item (for column blocks)
export interface BlockContentItem {
	workId?: number;
	// Crop settings (percentage-based for CSS clip-path)
	cropX?: number;
	cropY?: number;
	cropW?: number;
	cropH?: number;
	// Trim settings (seconds)
	trimStart?: number;
	trimEnd?: number;
}

// Block Content (JSON stored in database)
export interface BlockContent {
	items?: BlockContentItem[];
	text?: string;
	mediaId?: number;
}

// Block Model
export interface Block {
	id: number;
	uuid: string;
	modelName: string;
	modelId: number | null;
	parentId: number | null;
	type: BlockType;
	content: BlockContent;
	position: number;
	status: BlockStatus;
	createdAt: string;
	updatedAt: string;
	children?: Block[];
}

// Block Page Model
export interface BlockPage {
	id: number;
	type: BlockPageType;
	title: string;
	status: BlockStatus;
	createdAt: string;
	updatedAt: string;
	blocks?: Block[];
}

// Work Reference (minimal data for block editor)
export interface WorkReference {
	id: number;
	title: string;
	slug: string;
	videoFile?: {
		id: number;
		uuid: string;
		hlsUrl?: string;
		optimizedVideoUrl?: string;
	};
	previewImage?: {
		id: number;
		uuid: string;
	};
}

// Crop Preset
export interface CropPreset {
	name: string;
	label: string;
	aspectRatio: number | null; // null = free
}

export const CROP_PRESETS: CropPreset[] = [
	{ name: "1:1", label: "1:1 Square", aspectRatio: 1 },
	{ name: "4:5", label: "4:5 Portrait", aspectRatio: 4 / 5 },
	{ name: "16:9", label: "16:9 Wide", aspectRatio: 16 / 9 },
	{ name: "9:16", label: "9:16 Vertical", aspectRatio: 9 / 16 },
	{ name: "free", label: "Free", aspectRatio: null },
];
