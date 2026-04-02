import type { OutputData } from "@editorjs/editorjs";

// API Response Types
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: unknown;
		timestamp: string;
	};
	meta?: {
		pagination?: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	};
}

// User Types
export interface User {
	id: number;
	email: string;
	name: string;
	role: "ADMIN" | "EDITOR" | "VIEWER";
	createdAt: string;
	updatedAt: string;
}

// Media Types
export interface MediaFile {
	id: number;
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
	uuid: string;
	folderId?: number;
	folder?: MediaFolder;
	usageCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface MediaFolder {
	id: number;
	name: string;
	parentId?: number;
	path: string;
	children: MediaFolder[];
	files: MediaFile[];
	fileCount?: number;
	subfolderCount?: number;
	totalFileCount?: number;
	createdAt: string;
	updatedAt: string;
}

// Content Types
export interface Work {
	id: number;
	title: string;
	shortDescription: string;
	client: string;
	tags: string[];
	videoFile?: MediaFile;
	metaDescription?: string;
	metaKeywords?: string;
	previewImage?: MediaFile;
	status: "DRAFT" | "PUBLISHED";
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
}

export type TaxonomyType = "CLIENT" | "SECTOR" | "DISCIPLINE";

export interface Taxonomy {
	id: number;
	type: TaxonomyType;
	name: string;
	slug: string;
	status: "DRAFT" | "PUBLISHED";
	sortOrder: number;
	ogImageId?: number | null;
	metaDescription?: string | null;
	metaKeywords?: string | null;
	metadata?: any;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string | null;
	creator?: { id: number; name: string } | null;
	ogImage?: MediaFile | null;
	_count?: {
		works: number;
	};
}

export interface ContentPage {
	id: number;
	type: "ABOUT" | "CONTACT" | "LEGAL";
	title: string;
	contentBlocks?: OutputData | null;
	metaDescription?: string;
	metaKeywords?: string;
	previewImage?: MediaFile;
	status: "DRAFT" | "PUBLISHED";
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
}

// Activity Types
export interface Activity {
	id: number;
	userId: number;
	user: User;
	action: "create" | "update" | "delete";
	module: string;
	itemType: string;
	itemId: number;
	itemTitle: string;
	description: string;
	createdAt: string;
}

// Form Types
export interface LoginForm {
	email: string;
	password: string;
	rememberMe?: boolean;
}

export interface WorkForm {
	title: string;
	shortDescription: string;
	client: string;
	tags: string[];
	videoFileId?: number;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status: "DRAFT" | "PUBLISHED";
}
