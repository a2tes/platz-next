import { create } from "zustand";
import { toast } from "sonner";
import { MediaService } from "@/services/mediaService";

export type UploadingFileStatus =
	| "pending"
	| "uploading"
	| "success"
	| "error"
	| "cancelled";

export interface UploadingFile {
	id: string; // unique id for each upload
	file: File;
	status: UploadingFileStatus;
	progress: number;
	error?: string;
	abort?: () => void;
	folderId?: number;
	folderName?: string;
}

interface UploadState {
	uploadingFiles: UploadingFile[];
	showUploadProgress: boolean;
	isUploading: boolean;
	isCancelled: boolean;
	toastId: string | number | null;

	// Actions
	addFiles: (files: File[], folderId?: number, folderName?: string) => void;
	cancelAllUploads: () => void;
	clearCompleted: () => void;
	hideProgress: () => void;
	reset: () => void;

	// Internal actions (not typically called externally)
	_processQueue: (queryClient: {
		invalidateQueries: (opts: { queryKey: string[] }) => void;
	}) => Promise<void>;
	_updateToast: (isComplete?: boolean) => void;
}

let fileIdCounter = 0;

export const useUploadStore = create<UploadState>((set, get) => ({
	uploadingFiles: [],
	showUploadProgress: false,
	isUploading: false,
	isCancelled: false,
	toastId: null,

	addFiles: (files, folderId, folderName) => {
		const newFiles: UploadingFile[] = files.map((file) => ({
			id: `upload-${++fileIdCounter}`,
			file,
			status: "pending" as const,
			progress: 0,
			folderId,
			folderName: folderName || "Uncategorized",
		}));

		set((state) => ({
			uploadingFiles: [...state.uploadingFiles, ...newFiles],
			showUploadProgress: true,
			isCancelled: false,
		}));
	},

	cancelAllUploads: () => {
		const { uploadingFiles, toastId } = get();

		// Abort currently uploading file
		const currentlyUploading = uploadingFiles.find(
			(f) => f.status === "uploading"
		);
		if (currentlyUploading?.abort) {
			currentlyUploading.abort();
		}

		// Dismiss toast
		if (toastId) {
			toast.dismiss(toastId);
		}

		set({
			isCancelled: true,
			showUploadProgress: false,
			uploadingFiles: [],
			toastId: null,
		});
	},

	hideProgress: () => {
		set({ showUploadProgress: false });
	},

	clearCompleted: () => {
		set((state) => ({
			uploadingFiles: state.uploadingFiles.filter(
				(f) => f.status === "pending" || f.status === "uploading"
			),
		}));
	},

	reset: () => {
		const { toastId } = get();
		if (toastId) {
			toast.dismiss(toastId);
		}
		set({
			uploadingFiles: [],
			isUploading: false,
			isCancelled: false,
			toastId: null,
		});
	},

	_updateToast: (isComplete = false) => {
		const { uploadingFiles, toastId } = get();
		const total = uploadingFiles.length;
		if (total === 0) return;

		const successCount = uploadingFiles.filter(
			(f) => f.status === "success"
		).length;
		const failedCount = uploadingFiles.filter(
			(f) => f.status === "error"
		).length;

		// Only show toast when complete (panel handles progress display)
		if (isComplete) {
			// Dismiss any loading toast
			if (toastId) {
				toast.dismiss(toastId);
				set({ toastId: null });
			}

			if (successCount > 0 && failedCount === 0) {
				toast.success(
					`Uploaded ${successCount} file${successCount !== 1 ? "s" : ""}`
				);
			} else if (successCount > 0 && failedCount > 0) {
				toast.warning(
					`Uploaded ${successCount} file${
						successCount !== 1 ? "s" : ""
					}, ${failedCount} failed`
				);
			} else if (failedCount > 0) {
				toast.error(
					`Failed to upload ${failedCount} file${failedCount !== 1 ? "s" : ""}`
				);
			}
		}
	},

	_processQueue: async (queryClient) => {
		const state = get();

		// Prevent multiple concurrent processors
		if (state.isUploading) return;
		set({ isUploading: true });

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const currentState = get();

			// Check if cancelled
			if (currentState.isCancelled) {
				set((s) => ({
					uploadingFiles: s.uploadingFiles.map((f) =>
						f.status === "pending" ? { ...f, status: "cancelled" as const } : f
					),
				}));
				// Dismiss toast on cancel
				if (currentState.toastId) {
					toast.dismiss(currentState.toastId);
					set({ toastId: null });
				}
				break;
			}

			// Update toast with current progress
			get()._updateToast();

			// Find next pending file
			const pendingFile = currentState.uploadingFiles.find(
				(f) => f.status === "pending"
			);
			if (!pendingFile) {
				// No more files to upload
				break;
			}

			const pendingId = pendingFile.id;

			// Update status to uploading
			set((s) => ({
				uploadingFiles: s.uploadingFiles.map((f) =>
					f.id === pendingId
						? { ...f, status: "uploading" as const, progress: 0 }
						: f
				),
			}));
			get()._updateToast();

			try {
				await MediaService.uploadFile(
					pendingFile.file,
					pendingFile.folderId,
					// Progress callback
					(progress) => {
						set((s) => ({
							uploadingFiles: s.uploadingFiles.map((f) =>
								f.id === pendingId ? { ...f, progress } : f
							),
						}));
						// Update toast every 10%
						if (progress % 10 === 0 || progress === 100) {
							get()._updateToast();
						}
					},
					// Abort ready callback
					(controller) => {
						set((s) => ({
							uploadingFiles: s.uploadingFiles.map((f) =>
								f.id === pendingId ? { ...f, abort: controller.abort } : f
							),
						}));
					}
				);

				// Update status to success
				set((s) => ({
					uploadingFiles: s.uploadingFiles.map((f) =>
						f.id === pendingId
							? { ...f, status: "success" as const, progress: 100 }
							: f
					),
				}));
				get()._updateToast();
			} catch (error) {
				const currentState = get();
				if (currentState.isCancelled) {
					set((s) => ({
						uploadingFiles: s.uploadingFiles.map((f) =>
							f.id === pendingId ? { ...f, status: "cancelled" as const } : f
						),
					}));
				} else {
					const errorMessage =
						error instanceof Error ? error.message : "Upload failed";
					console.error(`Failed to upload ${pendingFile.file.name}:`, error);

					set((s) => ({
						uploadingFiles: s.uploadingFiles.map((f) =>
							f.id === pendingId
								? { ...f, status: "error" as const, error: errorMessage }
								: f
						),
					}));
					get()._updateToast();
				}
			}
		}

		set({ isUploading: false });

		// Refresh queries after all uploads
		queryClient.invalidateQueries({ queryKey: ["media-files"] });
		queryClient.invalidateQueries({ queryKey: ["folder-files"] });
		queryClient.invalidateQueries({ queryKey: ["media-folders"] });

		const finalState = get();
		const failedCount = finalState.uploadingFiles.filter(
			(f) => f.status === "error"
		).length;

		// Show final toast notification
		if (!finalState.isCancelled && finalState.uploadingFiles.length > 0) {
			get()._updateToast(true);
		}

		// Auto-clear after 3 seconds if all succeeded
		if (failedCount === 0 && !finalState.isCancelled) {
			setTimeout(() => {
				set({ uploadingFiles: [], showUploadProgress: false });
			}, 3000);
		}
	},
}));

// Helper hook to start processing (needs queryClient)
export const startUploadProcessing = (queryClient: {
	invalidateQueries: (opts: { queryKey: string[] }) => void;
}) => {
	const state = useUploadStore.getState();
	const hasPending = state.uploadingFiles.some((f) => f.status === "pending");
	if (hasPending && !state.isUploading && !state.isCancelled) {
		state._processQueue(queryClient);
	}
};
