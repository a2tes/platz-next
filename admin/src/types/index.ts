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
	directors: Director[];
	starrings: Starring[];
	metaDescription?: string;
	metaKeywords?: string;
	previewImage?: MediaFile;
	status: "DRAFT" | "PUBLISHED";
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
}

export interface Director {
	id: number;
	title: string;
	shortDescription: string;
	biography: string;
	avatar?: MediaFile;
	works: Work[];
	createdAt: string;
	updatedAt: string;
}

export interface Starring {
	id: number;
	title: string;
	shortDescription: string;
	biography: string;
	avatar?: MediaFile;
	works: Work[];
	createdAt: string;
	updatedAt: string;
}

export interface Photography {
	id: number;
	title: string;
	description: string;
	image: MediaFile;
	photographer: Photographer;
	category: PhotoCategory;
	client: string;
	year: number;
	location: string;
	metaDescription?: string;
	metaKeywords?: string;
	previewImage?: MediaFile;
	status: "DRAFT" | "PUBLISHED";
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
}

export interface Photographer {
	id: number;
	name: string;
	bio: string;
	avatar?: MediaFile;
	photography: Photography[];
	createdAt: string;
	updatedAt: string;
}

export interface PhotoCategory {
	id: number;
	name: string;
	slug: string;
	photography: Photography[];
	createdAt: string;
	updatedAt: string;
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
	directorIds: number[];
	starringIds: number[];
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status: "DRAFT" | "PUBLISHED";
}

export interface PhotographyForm {
	title: string;
	description: string;
	imageId: number;
	photographerId: number;
	categoryId: number;
	client: string;
	year: number;
	location: string;
	metaDescription?: string;
	metaKeywords?: string;
	previewImageId?: number;
	status: "DRAFT" | "PUBLISHED";
}
