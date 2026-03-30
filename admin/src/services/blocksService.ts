import api from "@/lib/api";

// ============================================
// BLOCK TYPES
// ============================================

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

export interface BlockContentItem {
	mediaId?: number;
	mediaType?: "video" | "image";
	mediaUrl?: string;
	thumbnailUrl?: string;
	workId?: number;
	cropSettings?: {
		x: number;
		y: number;
		width: number;
		height: number;
		aspect: number;
		aspectLabel?: string;
	};
	trimSettings?: {
		startTime: number;
		endTime: number;
	};
	processedVideo?: {
		status: "pending" | "processing" | "completed" | "failed";
		settingsHash?: string;
		outputPath?: string;
		url?: string;
		jobId?: string;
		error?: string;
		completedAt?: string;
	};
}

export interface BlockContent {
	items?: BlockContentItem[];
	[key: string]: unknown;
}

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
}

export interface BlockPage {
	id: number;
	type: BlockPageType;
	title: string;
	slug: string;
	status: BlockStatus;
	createdAt: string;
	updatedAt: string;
}

// ============================================
// BLOCK SERVICE
// ============================================

export interface GetBlocksParams {
	modelName: string;
	modelId?: number | null;
	sessionId?: string;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
}

export interface CreateBlockData {
	modelName: string;
	modelId?: number | null;
	parentId?: number | null;
	type: BlockType;
	content?: BlockContent;
	position?: number;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
}

export interface UpdateBlockData {
	type?: BlockType;
	content?: BlockContent;
	position?: number;
	status?: "DRAFT" | "PUBLISHED" | "UNLISTED";
	parentId?: number | null;
}

export interface ReorderBlocksData {
	blocks: { id: number; position: number }[];
}

export const blocksService = {
	// Get blocks for a model
	async getBlocks(params: GetBlocksParams): Promise<Block[]> {
		const searchParams = new URLSearchParams();
		searchParams.set("modelName", params.modelName);
		if (params.modelId !== undefined) {
			searchParams.set("modelId", String(params.modelId));
		}
		if (params.sessionId) {
			searchParams.set("sessionId", params.sessionId);
		}
		if (params.status) {
			searchParams.set("status", params.status);
		}

		const response = await api.get(`/api/blocks?${searchParams.toString()}`);
		return response.data.data;
	},

	// Get a single block
	async getBlock(id: number): Promise<Block> {
		const response = await api.get(`/api/blocks/${id}`);
		return response.data.data;
	},

	// Create a new block
	async createBlock(data: CreateBlockData): Promise<Block> {
		const response = await api.post("/api/blocks", data);
		return response.data.data;
	},

	// Update a block
	async updateBlock(id: number, data: UpdateBlockData): Promise<Block> {
		const response = await api.put(`/api/blocks/${id}`, data);
		return response.data.data;
	},

	// Delete a block
	async deleteBlock(id: number): Promise<void> {
		await api.delete(`/api/blocks/${id}`);
	},

	// Reorder blocks
	async reorderBlocks(data: ReorderBlocksData): Promise<void> {
		await api.put("/api/blocks/reorder", data);
	},

	// Assign temporary blocks to an entity
	async assignBlocks(modelName: string, sessionId: string, modelId: number): Promise<void> {
		await api.put("/api/blocks/assign", { modelName, sessionId, modelId });
	},

	// Publish blocks for an entity
	async publishBlocks(modelName: string, modelId: number): Promise<void> {
		await api.put("/api/blocks/publish", { modelName, modelId });
	},

	// Process video (crop/trim) or generate thumbnail for a block slot
	async processVideo(
		blockId: number,
		slotIndex: number,
		settings: {
			workId?: number;
			cropSettings?: BlockContentItem["cropSettings"];
			trimSettings?: BlockContentItem["trimSettings"];
			mode?: "clip" | "thumbnail";
		},
	): Promise<{ jobId: string; settingsHash: string; status: string }> {
		const response = await api.post(`/api/blocks/${blockId}/process-video`, {
			slotIndex,
			...settings,
		});
		return response.data.data;
	},

	// Save blocks (create or update)
	async saveBlocks(blocks: Block[], modelName: string, modelId: number | null): Promise<Block[]> {
		const savedBlocks: Block[] = [];

		for (const block of blocks) {
			if (block.id < 0) {
				// New block (temporary negative ID)
				const created = await this.createBlock({
					modelName,
					modelId,
					parentId: block.parentId,
					type: block.type,
					content: block.content,
					position: block.position,
					status: block.status as any,
				});
				savedBlocks.push(created);
			} else {
				// Existing block
				const updated = await this.updateBlock(block.id, {
					type: block.type,
					content: block.content,
					position: block.position,
					status: block.status as any,
				});
				savedBlocks.push(updated);
			}
		}

		return savedBlocks;
	},
};

// ============================================
// BLOCK PAGE SERVICE
// ============================================

export const blockPagesService = {
	// Get all block pages
	async getBlockPages(): Promise<BlockPage[]> {
		const response = await api.get("/api/blocks/pages");
		return response.data.data;
	},

	// Get a block page by type
	async getBlockPageByType(type: BlockPageType): Promise<BlockPage> {
		const response = await api.get(`/api/blocks/pages/${type}`);
		return response.data.data;
	},

	// Update a block page
	async updateBlockPage(
		id: number,
		data: { title?: string; status?: "DRAFT" | "PUBLISHED" | "UNLISTED" },
	): Promise<BlockPage> {
		const response = await api.put(`/api/blocks/pages/${id}`, data);
		return response.data.data;
	},
};

export default blocksService;
