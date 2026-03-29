import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { MediaService, MediaFile } from "@/services/mediaService";

/**
 * Hook to poll for video processing status updates
 * Automatically refreshes when videos complete processing
 *
 * @param files - Array of MediaFile objects to monitor
 * @param queryKeyToInvalidate - Query key to invalidate when status changes
 */
export function useProcessingVideosPolling(files: MediaFile[], queryKeyToInvalidate: (string | number | undefined)[]) {
	const queryClient = useQueryClient();
	const previousStatusesRef = useRef<Record<number, string | null | undefined>>({});
	const initializedRef = useRef(false);

	// Filter to only pending/processing videos
	const processingVideoIds = files
		.filter(
			(f) =>
				f.mimeType.startsWith("video/") && (f.processingStatus === "pending" || f.processingStatus === "processing")
		)
		.map((f) => f.id);

	// Initialize previous statuses from files on first render
	useEffect(() => {
		if (!initializedRef.current && files.length > 0) {
			for (const file of files) {
				if (file.mimeType.startsWith("video/")) {
					previousStatusesRef.current[file.id] = file.processingStatus;
				}
			}
			initializedRef.current = true;
		}
	}, [files]);

	// Fetch processing statuses
	const { data: statuses } = useQuery({
		queryKey: ["video-processing-status", processingVideoIds],
		queryFn: () => MediaService.getProcessingStatuses(processingVideoIds),
		enabled: processingVideoIds.length > 0,
		refetchInterval: processingVideoIds.length > 0 ? 3000 : false, // Poll every 3 seconds
		staleTime: 2000, // Consider data fresh for 2 seconds
	});

	// Check for status changes and invalidate queries
	useEffect(() => {
		if (!statuses) return;

		let shouldInvalidate = false;

		for (const [idStr, status] of Object.entries(statuses)) {
			const id = parseInt(idStr);
			const previousStatus = previousStatusesRef.current[id];
			const currentStatus = status.processingStatus;

			// If status changed to 'completed', invalidate queries
			if (currentStatus === "completed" && previousStatus !== "completed") {
				console.log(`[Polling] Video ${id} completed processing, refreshing...`);
				shouldInvalidate = true;
			}

			previousStatusesRef.current[id] = currentStatus;
		}

		if (shouldInvalidate) {
			// Invalidate the media files query to refresh thumbnails
			queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
		}
	}, [statuses, queryClient, queryKeyToInvalidate]);

	return {
		isPolling: processingVideoIds.length > 0,
		processingCount: processingVideoIds.length,
		statuses,
	};
}
