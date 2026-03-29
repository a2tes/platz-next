import { api } from "../lib/api";

export type VideoSource = "original" | "default_clip" | "clip";

export interface HomepageClipJob {
	id: string;
	status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
	outputUrl?: string | null;
	thumbnailUrl?: string | null;
	thumbnailPath?: string | null;
	outputMetadata?: { width: number; height: number; duration: number } | null;
	cropSettings?: { x: number; y: number; width: number; height: number; aspect: number; aspectLabel?: string } | null;
	trimSettings?: { startTime: number; endTime: number } | null;
}

export interface HomepageDirectorRow {
	id: number;
	directorId: number;
	workId: number;
	sortOrder: number;
	videoSource: VideoSource;
	clipJobId?: string | null;
	clipJob?: HomepageClipJob | null;
	director?: { id: number; title: string; slug: string; status: string };
	work?: {
		id: number;
		title: string;
		slug: string;
		status: string;
		videoFileId?: number | null;
		videoFile?: {
			images?: Record<string, string> | null;
			video?: {
				default?: string;
				hls?: string;
				mp4?: string;
				mp4_720p?: string;
				preview?: string;
				original?: string;
			} | null;
		} | null;
	};
}

export class HomepageService {
	static async getSelections(): Promise<HomepageDirectorRow[]> {
		const res = await api.get<{
			success: boolean;
			data: HomepageDirectorRow[];
		}>("/api/homepage/directors");
		return res.data.data;
	}

	static async addSelection(directorId: number, workId: number): Promise<HomepageDirectorRow> {
		const res = await api.post<{ success: boolean; data: HomepageDirectorRow }>("/api/homepage/directors", {
			directorId,
			workId,
		});
		return res.data.data;
	}

	static async removeSelection(selectionId: number): Promise<{ removed: boolean; id: number }> {
		const res = await api.delete<{
			success: boolean;
			data: { removed: boolean; id: number };
		}>(`/api/homepage/directors/${selectionId}`);
		return res.data.data;
	}

	static async reorder(itemIds: number[]): Promise<{ count: number }> {
		const res = await api.put<{ success: boolean; data: { count: number } }>(`/api/homepage/directors/reorder`, {
			itemIds,
		});
		return res.data.data;
	}

	static async updateVideoSource(
		selectionId: number,
		videoSource: VideoSource,
		clipJobId?: string,
	): Promise<HomepageDirectorRow> {
		const res = await api.put<{ success: boolean; data: HomepageDirectorRow }>(
			`/api/homepage/directors/selection/${selectionId}/video-source`,
			{ videoSource, clipJobId },
		);
		return res.data.data;
	}

	static async processClip(
		selectionId: number,
		settings: {
			cropSettings?: { x: number; y: number; width: number; height: number; aspect: number; aspectLabel?: string };
			trimSettings?: { startTime: number; endTime: number };
		},
	): Promise<{ jobId: string; settingsHash: string; status: string }> {
		const res = await api.post<{
			success: boolean;
			data: { jobId: string; settingsHash: string; status: string };
		}>(`/api/homepage/directors/selection/${selectionId}/process-clip`, settings);
		return res.data.data;
	}
}
