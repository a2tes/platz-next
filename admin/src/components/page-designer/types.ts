export type DesignerElementBlockType =
	| "HEADING"
	| "PARAGRAPH"
	| "QUOTE"
	| "MEDIA"
	| "SPACER"
	| "DIVIDER"
	| "EMBED"
	| "CODE_BLOCK";

export type DesignerLayoutBlockType =
	| "ONE_COLUMN"
	| "TWO_COLUMN"
	| "THREE_COLUMN"
	| "FOUR_COLUMN"
	| "ONE_TWO"
	| "TWO_ONE";

export type DesignerBlockType = DesignerElementBlockType | DesignerLayoutBlockType;

export const LAYOUT_BLOCK_TYPES: DesignerLayoutBlockType[] = [
	"ONE_COLUMN",
	"TWO_COLUMN",
	"THREE_COLUMN",
	"FOUR_COLUMN",
	"ONE_TWO",
	"TWO_ONE",
];

export function isLayoutBlockType(type: DesignerBlockType): type is DesignerLayoutBlockType {
	return LAYOUT_BLOCK_TYPES.includes(type as DesignerLayoutBlockType);
}

export interface SlotChildBlock {
	id: string;
	type: DesignerBlockType;
	content: Record<string, unknown>;
	position: number;
}

export function generateId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export function getDefaultContent(type: DesignerBlockType): Record<string, unknown> {
	const elementConfig = ELEMENT_BLOCK_TYPE_CONFIGS.find((c) => c.type === type);
	if (elementConfig) return { ...elementConfig.defaultContent };
	const layoutConfig = LAYOUT_BLOCK_TYPE_CONFIGS.find((c) => c.type === type);
	if (layoutConfig) {
		// Deep clone slots arrays
		const slots = (layoutConfig.defaultContent.slots as unknown[][]).map(() => [] as SlotChildBlock[]);
		return { slots };
	}
	return {};
}

export interface DesignerBlock {
	id: string;
	dbId?: number;
	type: DesignerBlockType;
	content: Record<string, unknown>;
	position: number;
}

export interface PageDesignerRef {
	save: (modelName: string, modelId: number) => Promise<void>;
	isDirty: () => boolean;
}

export interface BlockComponentProps {
	content: Record<string, unknown>;
	onChange: (content: Record<string, unknown>) => void;
	onFocus?: () => void;
}

export const ELEMENT_BLOCK_TYPE_CONFIGS: {
	type: DesignerElementBlockType;
	label: string;
	description: string;
	icon: string;
	defaultContent: Record<string, unknown>;
}[] = [
	{
		type: "HEADING",
		label: "Heading",
		description: "Title or section heading",
		icon: "heading",
		defaultContent: { text: "", level: 2 },
	},
	{
		type: "PARAGRAPH",
		label: "Paragraph",
		description: "Rich text content",
		icon: "paragraph",
		defaultContent: { html: "" },
	},
	{
		type: "MEDIA",
		label: "Image / Video",
		description: "Image or video from library",
		icon: "media",
		defaultContent: { mediaId: null, mediaType: null, url: null, alt: "", caption: "" },
	},
	{
		type: "QUOTE",
		label: "Quote",
		description: "Blockquote with citation",
		icon: "quote",
		defaultContent: { text: "", citation: "" },
	},
	{
		type: "CODE_BLOCK",
		label: "Code",
		description: "Code snippet",
		icon: "code",
		defaultContent: { code: "", language: "javascript" },
	},
	{
		type: "EMBED",
		label: "Embed",
		description: "YouTube, Vimeo, or other URL",
		icon: "embed",
		defaultContent: { url: "", caption: "" },
	},
	{
		type: "DIVIDER",
		label: "Divider",
		description: "Horizontal line separator",
		icon: "divider",
		defaultContent: { style: "solid" },
	},
	{
		type: "SPACER",
		label: "Spacer",
		description: "Vertical spacing",
		icon: "spacer",
		defaultContent: { height: 48 },
	},
];

export const LAYOUT_BLOCK_TYPE_CONFIGS: {
	type: DesignerLayoutBlockType;
	label: string;
	description: string;
	icon: string;
	slots: number;
	defaultContent: Record<string, unknown>;
}[] = [
	{
		type: "ONE_COLUMN",
		label: "1 Column",
		description: "Single column layout",
		icon: "one-column",
		slots: 1,
		defaultContent: { slots: [[]] },
	},
	{
		type: "TWO_COLUMN",
		label: "2 Columns",
		description: "Two equal columns",
		icon: "two-column",
		slots: 2,
		defaultContent: { slots: [[], []] },
	},
	{
		type: "THREE_COLUMN",
		label: "3 Columns",
		description: "Three equal columns",
		icon: "three-column",
		slots: 3,
		defaultContent: { slots: [[], [], []] },
	},
	{
		type: "FOUR_COLUMN",
		label: "4 Columns",
		description: "Four equal columns",
		icon: "four-column",
		slots: 4,
		defaultContent: { slots: [[], [], [], []] },
	},
	{
		type: "ONE_TWO",
		label: "1:2 Split",
		description: "One-third and two-thirds",
		icon: "one-two",
		slots: 2,
		defaultContent: { slots: [[], []] },
	},
	{
		type: "TWO_ONE",
		label: "2:1 Split",
		description: "Two-thirds and one-third",
		icon: "two-one",
		slots: 2,
		defaultContent: { slots: [[], []] },
	},
];

export const BLOCK_TYPE_CONFIGS = [
	...ELEMENT_BLOCK_TYPE_CONFIGS.map((c) => ({ ...c, slots: undefined })),
	...LAYOUT_BLOCK_TYPE_CONFIGS,
];

export const ALL_BLOCK_TYPE_CONFIGS = [
	...LAYOUT_BLOCK_TYPE_CONFIGS.map((c) => ({
		type: c.type as DesignerBlockType,
		label: c.label,
		description: c.description,
		icon: c.icon,
	})),
	...ELEMENT_BLOCK_TYPE_CONFIGS.map((c) => ({
		type: c.type as DesignerBlockType,
		label: c.label,
		description: c.description,
		icon: c.icon,
	})),
];
