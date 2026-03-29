import { create } from "zustand";
import { MediaFile, MediaFolder } from "../services/mediaService";

interface MediaState {
	// Files
	files: MediaFile[];
	selectedFiles: Set<number>;
	currentFolder: number | null;

	// Folders
	folders: MediaFolder[];

	// UI State
	viewMode: "grid" | "list";
	isUploading: boolean;
	uploadProgress: Record<string, number>;

	// Search
	searchQuery: string;
	searchResults: MediaFile[];

	// Pagination
	currentPage: number;
	totalPages: number;
	totalFiles: number;

	// Actions
	setFiles: (files: MediaFile[]) => void;
	addFiles: (files: MediaFile[]) => void;
	removeFile: (fileId: number) => void;
	updateFile: (fileId: number, updates: Partial<MediaFile>) => void;

	setSelectedFiles: (fileIds: Set<number>) => void;
	toggleFileSelection: (fileId: number) => void;
	selectAllFiles: () => void;
	clearSelection: () => void;

	setCurrentFolder: (folderId: number | null) => void;
	setFolders: (folders: MediaFolder[]) => void;
	addFolder: (folder: MediaFolder) => void;
	removeFolder: (folderId: number) => void;
	updateFolder: (folderId: number, updates: Partial<MediaFolder>) => void;

	setViewMode: (mode: "grid" | "list") => void;
	setUploading: (uploading: boolean) => void;
	setUploadProgress: (fileName: string, progress: number) => void;
	clearUploadProgress: () => void;

	setSearchQuery: (query: string) => void;
	setSearchResults: (results: MediaFile[]) => void;

	setPagination: (page: number, totalPages: number, totalFiles: number) => void;
}

export const useMediaStore = create<MediaState>((set) => ({
	// Initial state
	files: [],
	selectedFiles: new Set(),
	currentFolder: null,

	folders: [],

	viewMode: "grid",
	isUploading: false,
	uploadProgress: {},

	searchQuery: "",
	searchResults: [],

	currentPage: 1,
	totalPages: 1,
	totalFiles: 0,

	// File actions
	setFiles: (files) => set({ files }),

	addFiles: (newFiles) =>
		set((state) => ({
			files: [...newFiles, ...state.files],
			totalFiles: state.totalFiles + newFiles.length,
		})),

	removeFile: (fileId) =>
		set((state) => ({
			files: state.files.filter((f) => f.id !== fileId),
			selectedFiles: new Set(
				[...state.selectedFiles].filter((id) => id !== fileId)
			),
			totalFiles: Math.max(0, state.totalFiles - 1),
		})),

	updateFile: (fileId, updates) =>
		set((state) => ({
			files: state.files.map((f) =>
				f.id === fileId ? { ...f, ...updates } : f
			),
		})),

	// Selection actions
	setSelectedFiles: (fileIds) => set({ selectedFiles: fileIds }),

	toggleFileSelection: (fileId) =>
		set((state) => {
			const newSelection = new Set(state.selectedFiles);
			if (newSelection.has(fileId)) {
				newSelection.delete(fileId);
			} else {
				newSelection.add(fileId);
			}
			return { selectedFiles: newSelection };
		}),

	selectAllFiles: () =>
		set((state) => ({
			selectedFiles: new Set(state.files.map((f) => f.id)),
		})),

	clearSelection: () => set({ selectedFiles: new Set() }),

	// Folder actions
	setCurrentFolder: (folderId) =>
		set({
			currentFolder: folderId,
			selectedFiles: new Set(), // Clear selection when changing folders
		}),

	setFolders: (folders) => set({ folders }),

	addFolder: (folder) =>
		set((state) => ({
			folders: [...state.folders, folder],
		})),

	removeFolder: (folderId) =>
		set((state) => ({
			folders: state.folders.filter((f) => f.id !== folderId),
		})),

	updateFolder: (folderId, updates) =>
		set((state) => ({
			folders: state.folders.map((f) =>
				f.id === folderId ? { ...f, ...updates } : f
			),
		})),

	// UI actions
	setViewMode: (mode) => set({ viewMode: mode }),

	setUploading: (uploading) => set({ isUploading: uploading }),

	setUploadProgress: (fileName, progress) =>
		set((state) => ({
			uploadProgress: { ...state.uploadProgress, [fileName]: progress },
		})),

	clearUploadProgress: () => set({ uploadProgress: {} }),

	// Search actions
	setSearchQuery: (query) => set({ searchQuery: query }),

	setSearchResults: (results) => set({ searchResults: results }),

	// Pagination actions
	setPagination: (page, totalPages, totalFiles) =>
		set({
			currentPage: page,
			totalPages,
			totalFiles,
		}),
}));
