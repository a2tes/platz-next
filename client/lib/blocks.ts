import { getApiUrl } from "./utils";

export type BlockType = "ONE_COLUMN" | "TWO_COLUMN" | "THREE_COLUMN" | "FOUR_COLUMN" | "ONE_TWO" | "TWO_ONE";
export type BlockPageType = "WORKS" | "ANIMATIONS";

export interface BlockWork {
	title: string;
	slug: string;
	client: string;
	shortDescription: string;
	subtitle?: string;
	caseStudy?: string;
	starring: string;
	directors?: Array<{ title: string; slug?: string }>;
	videoUrl: string | null;
	videoAspectRatio: number;
	thumbnail: string | null;
	thumbnailUrl: string | null;
	thumbnailAspectRatio: number;
}

export interface BlockAnimation {
	title: string;
	slug: string;
	client: string;
	shortDescription: string;
	videoUrl: string | null;
	videoAspectRatio: number;
	thumbnail: string | null;
	thumbnailUrl: string | null;
	thumbnailAspectRatio: number;
}

export interface ProcessedVideo {
	url?: string;
}

export interface BlockContentItem {
	workId?: number;
	animationId?: number;
	clip?: ProcessedVideo;
	work?: BlockWork;
	animation?: BlockAnimation;
	display?: "video" | "thumbnail";
}

export interface Block {
	id: number;
	type: BlockType;
	content: (BlockContentItem | null)[];
	sortOrder: number;
}

export interface BlockPage {
	id: number;
	type: BlockPageType;
	blocks: Block[];
	isPublished: boolean;
}

export interface BlockPagePaginatedResponse {
	blocks: Block[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export async function getBlockPage(
	type: BlockPageType,
	options?: {
		page?: number;
		limit?: number;
	},
): Promise<BlockPagePaginatedResponse | null> {
	try {
		const page = options?.page || 1;
		const limit = options?.limit || 5;
		const endpoint = type === "WORKS" ? "works" : "animations";
		const res = await fetch(`${getApiUrl()}/api/public/${endpoint}?page=${page}&limit=${limit}`);
		if (!res.ok) {
			return null;
		}
		const json = await res.json();
		// API returns { data: Block[], meta: { pagination } }
		const rawBlocks = json.data || [];

		// Transform API response to match client Block interface
		const blocks: Block[] = rawBlocks.map((rawBlock: any) => ({
			id: rawBlock.id,
			type: rawBlock.type,
			// API stores content in content.items, client expects content array directly
			content: rawBlock.content?.items || rawBlock.content || [],
			// API uses 'position', client expects 'sortOrder'
			sortOrder: rawBlock.position ?? 0,
		}));

		return {
			blocks,
			pagination: json.meta?.pagination || {
				page,
				limit,
				total: blocks.length,
				totalPages: 1,
			},
		};
	} catch (error) {
		console.error("Failed to fetch block page:", error);
		return null;
	}
}

export async function getDirectorBlocks(
	slug: string,
	options?: {
		page?: number;
		limit?: number;
	},
): Promise<BlockPagePaginatedResponse | null> {
	try {
		const page = options?.page || 1;
		const limit = options?.limit || 5;
		const res = await fetch(
			`${getApiUrl()}/api/public/directors/${encodeURIComponent(slug)}/blocks?page=${page}&limit=${limit}`,
		);
		if (!res.ok) {
			return null;
		}
		const json = await res.json();
		const rawBlocks = json.data || [];

		const blocks: Block[] = rawBlocks.map((rawBlock: any) => ({
			id: rawBlock.id,
			type: rawBlock.type,
			content: rawBlock.content?.items || rawBlock.content || [],
			sortOrder: rawBlock.position ?? 0,
		}));

		return {
			blocks,
			pagination: json.meta?.pagination || {
				page,
				limit,
				total: blocks.length,
				totalPages: 1,
			},
		};
	} catch (error) {
		console.error("Failed to fetch director blocks:", error);
		return null;
	}
}

/**
 * Format seconds to MM:SS
 */
export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}
