import { create } from "zustand";
import type { Block, BlockType, BlockContent, BlockPage, BlockContentItem } from "@/services/blocksService";

// Generate UUID - fallback for environments where crypto.randomUUID is not available
function generateUUID(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback implementation
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

interface BlockEditorState {
	// Modal state
	isOpen: boolean;
	modelName: string;
	modelId: number | null;
	sessionId: string | null;
	title: string | null;
	pageData: BlockPage | null;

	// Editor state
	blocks: Block[];
	selectedBlockId: number | null;
	previewMode: boolean;
	isDirty: boolean;

	// Video settings modal
	isVideoSettingsOpen: boolean;
	editingBlockId: number | null;
	editingItemIndex: number | null;

	// Actions
	openBlockEditor: (modelName: string, modelId: number | null, sessionId?: string, title?: string) => void;
	closeBlockEditor: () => void;
	setPageData: (page: BlockPage) => void;
	setBlocks: (blocks: Block[]) => void;
	addBlock: (type: BlockType, position?: number) => void;
	updateBlock: (id: number, updates: Partial<Block>) => void;
	updateBlockContent: (id: number, content: Partial<BlockContent>) => void;
	deleteBlock: (id: number) => void;
	reorderBlocks: (startIndex: number, endIndex: number) => void;
	selectBlock: (id: number | null) => void;
	togglePreviewMode: () => void;
	setDirty: (dirty: boolean) => void;

	// Video settings modal actions
	openVideoSettings: (blockId: number, itemIndex: number) => void;
	closeVideoSettings: () => void;
	updateVideoSettings: (settings: Partial<BlockContentItem>) => void;
}

let tempIdCounter = -1;

export const useBlockEditorStore = create<BlockEditorState>((set, get) => ({
	// Initial state
	isOpen: false,
	modelName: "",
	modelId: null,
	sessionId: null,
	title: null,
	pageData: null,
	blocks: [],
	selectedBlockId: null,
	previewMode: false,
	isDirty: false,
	isVideoSettingsOpen: false,
	editingBlockId: null,
	editingItemIndex: null,

	// Actions
	openBlockEditor: (modelName, modelId, sessionId, title) => {
		set({
			isOpen: true,
			modelName,
			modelId,
			sessionId: sessionId || generateUUID(),
			title: title || null,
			blocks: [],
			selectedBlockId: null,
			previewMode: false,
			isDirty: false,
		});
	},

	closeBlockEditor: () => {
		set({
			isOpen: false,
			modelName: "",
			modelId: null,
			sessionId: null,
			title: null,
			pageData: null,
			blocks: [],
			selectedBlockId: null,
			previewMode: false,
			isDirty: false,
			isVideoSettingsOpen: false,
			editingBlockId: null,
			editingItemIndex: null,
		});
	},

	setPageData: (page) => {
		set({ pageData: page });
	},

	setBlocks: (blocks) => {
		set({ blocks });
	},

	addBlock: (type, position) => {
		const { blocks } = get();
		const newPosition = position ?? blocks.length;

		// Create initial content based on block type
		const content: BlockContent = {};
		if (["ONE_COLUMN", "TWO_COLUMN", "THREE_COLUMN", "CUSTOM_COLUMN"].includes(type)) {
			const itemCount = type === "ONE_COLUMN" ? 1 : type === "TWO_COLUMN" ? 2 : type === "THREE_COLUMN" ? 3 : 0;
			content.items = Array(itemCount)
				.fill(null)
				.map(() => ({}));
		}

		const newBlock: Block = {
			id: tempIdCounter--,
			uuid: generateUUID(),
			modelName: get().modelName,
			modelId: get().modelId,
			parentId: null,
			type,
			content,
			position: newPosition,
			status: "DRAFT",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		// Update positions of existing blocks
		const updatedBlocks = blocks.map((block) => ({
			...block,
			position: block.position >= newPosition ? block.position + 1 : block.position,
		}));

		set({
			blocks: [...updatedBlocks, newBlock].sort((a, b) => a.position - b.position),
			selectedBlockId: newBlock.id,
			isDirty: true,
		});
	},

	updateBlock: (id, updates) => {
		const { blocks } = get();
		set({
			blocks: blocks.map((block) =>
				block.id === id ? { ...block, ...updates, updatedAt: new Date().toISOString() } : block,
			),
			isDirty: true,
		});
	},

	updateBlockContent: (id, content) => {
		const { blocks } = get();
		set({
			blocks: blocks.map((block) =>
				block.id === id
					? {
							...block,
							content: { ...block.content, ...content },
							updatedAt: new Date().toISOString(),
						}
					: block,
			),
			isDirty: true,
		});
	},

	deleteBlock: (id) => {
		const { blocks, selectedBlockId } = get();
		const deletedBlock = blocks.find((b) => b.id === id);
		if (!deletedBlock) return;

		const updatedBlocks = blocks
			.filter((block) => block.id !== id)
			.map((block) => ({
				...block,
				position: block.position > deletedBlock.position ? block.position - 1 : block.position,
			}));

		set({
			blocks: updatedBlocks,
			selectedBlockId: selectedBlockId === id ? null : selectedBlockId,
			isDirty: true,
		});
	},

	reorderBlocks: (startIndex, endIndex) => {
		const { blocks } = get();
		const result = Array.from(blocks);
		const [removed] = result.splice(startIndex, 1);
		result.splice(endIndex, 0, removed);

		// Update positions
		const updatedBlocks = result.map((block, index) => ({
			...block,
			position: index,
		}));

		set({ blocks: updatedBlocks, isDirty: true });
	},

	selectBlock: (id) => {
		set({ selectedBlockId: id });
	},

	togglePreviewMode: () => {
		set((state) => ({ previewMode: !state.previewMode }));
	},

	setDirty: (dirty) => {
		set({ isDirty: dirty });
	},

	// Video settings modal actions
	openVideoSettings: (blockId, itemIndex) => {
		set({
			isVideoSettingsOpen: true,
			editingBlockId: blockId,
			editingItemIndex: itemIndex,
		});
	},

	closeVideoSettings: () => {
		set({
			isVideoSettingsOpen: false,
			editingBlockId: null,
			editingItemIndex: null,
		});
	},

	updateVideoSettings: (settings) => {
		const { blocks, editingBlockId, editingItemIndex } = get();
		if (editingBlockId === null || editingItemIndex === null) return;

		set({
			blocks: blocks.map((block) => {
				if (block.id !== editingBlockId) return block;

				const items = [...(block.content.items || [])];
				items[editingItemIndex] = {
					...items[editingItemIndex],
					...settings,
				};

				return {
					...block,
					content: { ...block.content, items },
					updatedAt: new Date().toISOString(),
				};
			}),
			isDirty: true,
		});
	},
}));
