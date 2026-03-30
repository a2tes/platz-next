import { create } from "zustand";
import type { DesignerBlock, DesignerBlockType } from "@/components/page-designer/types";
import { ELEMENT_BLOCK_TYPE_CONFIGS, LAYOUT_BLOCK_TYPE_CONFIGS, generateId } from "@/components/page-designer/types";
import { blocksService } from "@/services/blocksService";

interface PageDesignerState {
	blocks: DesignerBlock[];
	activeBlockId: string | null;
	isDirty: boolean;
	isLoading: boolean;
	deletedDbIds: number[];

	// Actions
	setBlocks: (blocks: DesignerBlock[]) => void;
	addBlock: (type: DesignerBlockType, position?: number) => void;
	updateBlockContent: (id: string, content: Record<string, unknown>) => void;
	deleteBlock: (id: string) => void;
	moveBlock: (fromIndex: number, toIndex: number) => void;
	setActiveBlock: (id: string | null) => void;
	setLoading: (loading: boolean) => void;
	reset: () => void;

	// Persistence
	loadBlocks: (modelName: string, modelId: number) => Promise<void>;
	saveBlocks: (modelName: string, modelId: number) => Promise<void>;
}

export const usePageDesignerStore = create<PageDesignerState>((set, get) => ({
	blocks: [],
	activeBlockId: null,
	isDirty: false,
	isLoading: false,
	deletedDbIds: [],

	setBlocks: (blocks) => set({ blocks, isDirty: false, deletedDbIds: [] }),

	addBlock: (type, position) => {
		const elementConfig = ELEMENT_BLOCK_TYPE_CONFIGS.find((c) => c.type === type);
		const layoutConfig = LAYOUT_BLOCK_TYPE_CONFIGS.find((c) => c.type === type);
		const config = elementConfig || layoutConfig;
		if (!config) return;

		const { blocks } = get();
		const insertAt = position !== undefined ? position : blocks.length;

		const newBlock: DesignerBlock = {
			id: generateId(),
			type,
			content: { ...config.defaultContent },
			position: insertAt,
		};

		const updated = [...blocks];
		updated.splice(insertAt, 0, newBlock);

		// Recalculate positions
		updated.forEach((b, i) => (b.position = i));

		set({ blocks: updated, isDirty: true });
	},

	updateBlockContent: (id, content) => {
		const { blocks } = get();
		set({
			blocks: blocks.map((b) => (b.id === id ? { ...b, content: { ...b.content, ...content } } : b)),
			isDirty: true,
		});
	},

	deleteBlock: (id) => {
		const { blocks, deletedDbIds } = get();
		const block = blocks.find((b) => b.id === id);
		const newDeletedDbIds = block?.dbId ? [...deletedDbIds, block.dbId] : deletedDbIds;
		const updated = blocks.filter((b) => b.id !== id);
		updated.forEach((b, i) => (b.position = i));
		set({ blocks: updated, isDirty: true, deletedDbIds: newDeletedDbIds });
	},

	moveBlock: (fromIndex, toIndex) => {
		const { blocks } = get();
		const updated = [...blocks];
		const [moved] = updated.splice(fromIndex, 1);
		updated.splice(toIndex, 0, moved);
		updated.forEach((b, i) => (b.position = i));
		set({ blocks: updated, isDirty: true });
	},

	setActiveBlock: (id) => set({ activeBlockId: id }),

	setLoading: (loading) => set({ isLoading: loading }),

	reset: () =>
		set({
			blocks: [],
			activeBlockId: null,
			isDirty: false,
			isLoading: false,
			deletedDbIds: [],
		}),

	loadBlocks: async (modelName, modelId) => {
		set({ isLoading: true });
		try {
			const apiBlocks = await blocksService.getBlocks({ modelName, modelId });
			const supportedTypes: string[] = [
				"HEADING",
				"PARAGRAPH",
				"QUOTE",
				"MEDIA",
				"SPACER",
				"DIVIDER",
				"EMBED",
				"CODE_BLOCK",
				"ONE_COLUMN",
				"TWO_COLUMN",
				"THREE_COLUMN",
				"FOUR_COLUMN",
				"ONE_TWO",
				"TWO_ONE",
			];
			const designerBlocks: DesignerBlock[] = apiBlocks
				.filter((b) => {
					return supportedTypes.includes(b.type);
				})
				.map((b) => ({
					id: b.uuid,
					dbId: b.id,
					type: b.type as DesignerBlockType,
					content: (b.content as Record<string, unknown>) || {},
					position: b.position,
				}));
			set({ blocks: designerBlocks, isDirty: false, isLoading: false, deletedDbIds: [] });
		} catch (error) {
			console.error("Failed to load blocks:", error);
			set({ isLoading: false });
		}
	},

	saveBlocks: async (modelName, modelId) => {
		const { blocks, deletedDbIds } = get();

		// Delete removed blocks
		for (const dbId of deletedDbIds) {
			try {
				await blocksService.deleteBlock(dbId);
			} catch (error: unknown) {
				const status = (error as { response?: { status?: number } })?.response?.status;
				if (status !== 404) console.warn(`Failed to delete block ${dbId}:`, error);
			}
		}

		// Create or update blocks
		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			if (block.dbId) {
				await blocksService.updateBlock(block.dbId, {
					type: block.type as any,
					content: block.content as any,
					position: i,
				});
			} else {
				const created = await blocksService.createBlock({
					modelName,
					modelId,
					type: block.type as any,
					content: block.content as any,
					position: i,
				});
				block.dbId = created.id;
			}
		}

		set({ isDirty: false, deletedDbIds: [] });
	},
}));
