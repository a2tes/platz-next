import { create } from "zustand";
import { MediaFile, MediaFolder } from "../types/media";

export type MediaLibraryTab = "upload" | "images" | "videos" | "files" | "folders" | "clips";
export type MediaViewMode = "grid" | "list";

export interface SelectedItem {
	id: number;
	type: "file" | "folder";
	data: MediaFile | MediaFolder;
}

interface MediaLibraryState {
	// Modal state
	isOpen: boolean;
	activeTab: MediaLibraryTab;
	searchQuery: string;
	viewMode: MediaViewMode;
	isTrashView: boolean;

	// Selection state
	selectedFiles: MediaFile[];
	selectedItems: SelectedItem[]; // New: supports both files and folders
	multiSelect: boolean;

	// Visible files in current view (for Select All functionality)
	visibleFiles: MediaFile[];

	// Sidebar state
	sidebarFile: MediaFile | null;

	// Global refresh token to force list reloads (e.g., after delete/move)
	mediaRefreshToken: number;

	// Lightweight event to signal moved files without full reload
	lastFilesMove?: { ids: number[]; targetFolderId?: number } | null;
	filesMoveToken: number;

	// Lightweight event to signal updated file without full reload
	lastFileUpdate?: MediaFile | null;
	fileUpdateToken: number;

	// Folder state
	currentFolder: MediaFolder | null;
	expandedFolders: number[];

	// Selector mode (for media selection like in Works form)
	selectionMode: "browse" | "select"; // "browse" = normal, "select" = selection mode
	selectionFilter?: "image" | "video" | "document" | "all"; // Filter shown files
	onSelectionCallback?: (file: MediaFile) => void; // Callback when file is selected
	onMultiSelectCallback?: (files: MediaFile[]) => void; // Callback when files are selected in multi-select mode

	// Optional crop options when opening selector: if provided and applicable, a crop modal will be shown before finalizing selection
	cropOptions?: {
		aspect?: number;
		subjectType?: string;
		subjectId?: number;
		usageKey?: string;
	};

	// Actions
	openModal: () => void;
	closeModal: () => void;
	openSelectorModal: (
		filter?: "image" | "video" | "document",
		callback?: (file: MediaFile) => void,
		cropOptions?: MediaLibraryState["cropOptions"],
	) => void;
	openMultiSelectorModal: (
		filter?: "image" | "video" | "document" | "all",
		callback?: (files: MediaFile[]) => void,
	) => void;
	setActiveTab: (tab: MediaLibraryTab) => void;
	setSearchQuery: (query: string) => void;
	setViewMode: (mode: MediaViewMode) => void;
	bumpMediaRefreshToken: () => void;
	// Notify grids to update moved files in-place
	notifyFilesMoved: (ids: number[], targetFolderId?: number) => void;
	// Notify grids to update single file in-place
	notifyFileUpdated: (file: MediaFile) => void;

	// Selection actions
	selectFile: (file: MediaFile) => void;
	deselectFile: (fileId: number) => void;
	selectItem: (item: SelectedItem) => void; // New: select file or folder
	deselectItem: (id: number, type: "file" | "folder") => void; // New
	toggleItemSelection: (item: SelectedItem) => void; // New
	clearSelection: () => void;
	setMultiSelect: (enabled: boolean) => void;
	setVisibleFiles: (files: MediaFile[]) => void;
	selectAllVisibleFiles: () => void;

	// Sidebar actions
	setSidebarFile: (file: MediaFile | null) => void;

	// Folder actions
	setCurrentFolder: (folder: MediaFolder | null) => void;
	toggleFolderExpanded: (folderId: number) => void;
	setTrashView: (enabled: boolean) => void;
	setSelectionFilter: (filter: "image" | "video" | "document" | "all") => void;

	// Reset state
	reset: () => void;
}

export const useMediaLibraryStore = create<MediaLibraryState>((set, get) => ({
	// Initial state
	isOpen: false,
	activeTab: "folders",
	searchQuery: "",
	viewMode: "grid",
	isTrashView: false,
	selectedFiles: [],
	selectedItems: [],
	multiSelect: false,
	visibleFiles: [],
	sidebarFile: null,
	mediaRefreshToken: 0,
	filesMoveToken: 0,
	fileUpdateToken: 0,
	currentFolder: null,
	expandedFolders: [],
	selectionMode: "browse",
	selectionFilter: "all",
	onSelectionCallback: undefined,
	onMultiSelectCallback: undefined,
	cropOptions: undefined,

	// Modal actions
	openModal: () => set({ isOpen: true, selectionMode: "browse" }),
	closeModal: () => {
		set({ isOpen: false });
		// Reset state when closing
		get().reset();
	},
	openSelectorModal: (
		filter: "image" | "video" | "document" | "all" = "all",
		callback?: (file: MediaFile) => void,
		cropOptions?: MediaLibraryState["cropOptions"],
	) => {
		set({
			isOpen: true,
			selectionMode: "select",
			selectionFilter: filter,
			onSelectionCallback: callback,
			cropOptions,
			activeTab:
				filter === "image" ? "images" : filter === "video" ? "videos" : filter === "document" ? "files" : "folders",
		});
	},
	openMultiSelectorModal: (
		filter: "image" | "video" | "document" | "all" = "all",
		callback?: (files: MediaFile[]) => void,
	) => {
		set({
			isOpen: true,
			selectionMode: "browse",
			selectionFilter: filter,
			onMultiSelectCallback: callback,
			multiSelect: true,
			activeTab:
				filter === "image" ? "images" : filter === "video" ? "videos" : filter === "document" ? "files" : "folders",
		});
	},
	setActiveTab: (tab) => {
		// Clear currentFolder when switching to images, videos, or files tabs
		// Only keep currentFolder for folders tab
		const shouldClearFolder = tab === "images" || tab === "videos" || tab === "files";
		set({
			activeTab: tab,
			searchQuery: "",
			selectedFiles: [],
			selectedItems: [],
			sidebarFile: null,
			currentFolder: shouldClearFolder ? null : get().currentFolder,
		});
	},
	setSearchQuery: (query) => set({ searchQuery: query }),
	setViewMode: (mode) => set({ viewMode: mode }),
	bumpMediaRefreshToken: () => set((s) => ({ mediaRefreshToken: s.mediaRefreshToken + 1 })),

	// Signal that specific files were moved; grids can update locally
	notifyFilesMoved: (ids, targetFolderId) =>
		set((state) => ({
			lastFilesMove: { ids, targetFolderId },
			filesMoveToken: state.filesMoveToken + 1,
		})),
	notifyFileUpdated: (file) =>
		set((state) => ({
			lastFileUpdate: file,
			fileUpdateToken: state.fileUpdateToken + 1,
		})),

	selectFile: (file) =>
		set((state) => {
			const { selectedFiles, multiSelect } = state;

			if (multiSelect) {
				// Add to selection if not already selected
				if (!selectedFiles.find((f) => f.id === file.id)) {
					return { selectedFiles: [...selectedFiles, file] };
				}
			} else {
				// Single selection
				return { selectedFiles: [file], sidebarFile: file };
			}

			return {};
		}),

	deselectFile: (fileId) => {
		const { selectedFiles, sidebarFile } = get();
		const newSelection = selectedFiles.filter((f) => f.id !== fileId);
		set({
			selectedFiles: newSelection,
			sidebarFile: sidebarFile?.id === fileId ? null : sidebarFile,
		});
	},

	// New selection methods for items (files and folders)
	selectItem: (item) => {
		const { selectedItems, multiSelect } = get();

		if (multiSelect) {
			// Add to selection if not already selected
			const exists = selectedItems.find((i) => i.id === item.id && i.type === item.type);
			if (!exists) {
				set({ selectedItems: [...selectedItems, item] });
			}
		} else {
			// Single selection
			set({
				selectedItems: [item],
				sidebarFile: item.type === "file" ? (item.data as MediaFile) : null,
			});
		}
	},

	deselectItem: (id, type) => {
		const { selectedItems } = get();
		const newSelection = selectedItems.filter((i) => !(i.id === id && i.type === type));
		set({ selectedItems: newSelection });
	},

	toggleItemSelection: (item) => {
		const { selectedItems } = get();
		const exists = selectedItems.find((i) => i.id === item.id && i.type === item.type);

		if (exists) {
			get().deselectItem(item.id, item.type);
		} else {
			get().selectItem(item);
		}
	},

	clearSelection: () => set({ selectedFiles: [], selectedItems: [], sidebarFile: null }),
	setMultiSelect: (enabled) => set({ multiSelect: enabled }),

	setVisibleFiles: (files) => set({ visibleFiles: files }),

	selectAllVisibleFiles: () => {
		const { visibleFiles } = get();
		const newSelectedItems = visibleFiles.map((file) => ({
			id: file.id,
			type: "file" as const,
			data: file,
		}));
		// Also update selectedFiles for modal callback compatibility
		set({ selectedItems: newSelectedItems, selectedFiles: visibleFiles });
	},

	// Sidebar actions
	setSidebarFile: (file) => set({ sidebarFile: file }),

	// Folder actions
	setCurrentFolder: (folder) => set({ currentFolder: folder }),
	toggleFolderExpanded: (folderId) => {
		const { expandedFolders } = get();
		const isExpanded = expandedFolders.includes(folderId);

		if (isExpanded) {
			set({ expandedFolders: expandedFolders.filter((id) => id !== folderId) });
		} else {
			set({ expandedFolders: [...expandedFolders, folderId] });
		}
	},

	setTrashView: (enabled) =>
		set({
			isTrashView: enabled,
			currentFolder: null,
			selectedItems: [],
			sidebarFile: null,
		}),

	setSelectionFilter: (filter) => set({ selectionFilter: filter }),

	// Reset state
	reset: () =>
		set({
			activeTab: "folders",
			searchQuery: "",
			viewMode: "grid",
			isTrashView: false,
			selectedFiles: [],
			multiSelect: false,
			sidebarFile: null,
			currentFolder: null,
			expandedFolders: [],
			mediaRefreshToken: 0,
			lastFilesMove: null,
			filesMoveToken: 0,
			fileUpdateToken: 0,
			selectionMode: "browse",
			selectionFilter: "all",
			onSelectionCallback: undefined,
			onMultiSelectCallback: undefined,
			cropOptions: undefined,
			visibleFiles: [],
		}),
}));
