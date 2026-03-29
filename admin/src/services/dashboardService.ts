import api from "../lib/api";
import React from "react";
import {
	IconPlus,
	IconPencil,
	IconTrash,
	IconEye,
	IconEyeOff,
	IconUpload,
	IconArrowsMove,
	IconCopy,
	IconNotes,
	IconTrashOff,
	IconRestore,
} from "@tabler/icons-react";

export interface Activity {
	id: number;
	title: string;
	description: string;
	module: string;
	itemType: string;
	action: string;
	user?: {
		id: number;
		name: string;
		email: string;
	};
	createdAt: string;
	metadata?: Record<string, unknown>;
}

export interface ActivityResponse {
	activities: Activity[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface DashboardStats {
	contentStats: {
		works: {
			published: number;
			draft: number;
			total: number;
		};
		photography: {
			published: number;
			draft: number;
			total: number;
		};
		directors: {
			published: number;
			draft: number;
			total: number;
		};
		starrings: {
			published: number;
			draft: number;
			total: number;
		};
		photographers: {
			published: number;
			draft: number;
			total: number;
		};
		users: {
			published: number;
			draft: number;
			total: number;
		};
		homepageDirectors: {
			total: number;
		};
		mediaFiles: {
			total: number;
			storageSize: number;
		};
	};
	activityStats: {
		period: string;
		stats: Array<{
			action: string;
			module: string;
			count: number;
		}>;
		totalActivities: number;
	};
	recentActivities: Array<{
		id: number;
		title: string;
		description: string;
		module: string;
		action: string;
		user: string;
		createdAt: string;
	}>;
}

export interface ModuleStats {
	period: string;
	modules: Array<{
		module: string;
		totalActivities: number;
		actions: Record<string, number>;
	}>;
}

export interface UserStats {
	period: string;
	users: Array<{
		user: {
			id: number;
			name: string;
			email: string;
			role: string;
		};
		activityCount: number;
	}>;
}

export interface ActivityTimeline {
	period: string;
	interval: string;
	timeline: Array<{
		date: string;
		total: number;
		actions: Record<string, number>;
		modules: Record<string, number>;
	}>;
}

export interface ActivityFilters {
	page?: number;
	limit?: number;
	module?: string;
	action?: string;
	itemType?: string;
	startDate?: string;
	endDate?: string;
	search?: string;
}

export class DashboardService {
	/**
	 * Get all activities (admin view)
	 */
	static async getAllActivities(filters: ActivityFilters = {}): Promise<ActivityResponse> {
		const params = new URLSearchParams();

		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== "") {
				params.append(key, value.toString());
			}
		});

		const response = await api.get(`/api/dashboard/activities/all?${params.toString()}`);
		return response.data.data;
	}

	/**
	 * Get user's activities (my activity view)
	 */
	static async getMyActivities(filters: ActivityFilters = {}): Promise<ActivityResponse> {
		const params = new URLSearchParams();

		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== "") {
				params.append(key, value.toString());
			}
		});

		const response = await api.get(`/api/dashboard/activities/my?${params.toString()}`);
		return response.data.data;
	}

	/**
	 * Get dashboard statistics
	 */
	static async getDashboardStats(days: number = 30): Promise<DashboardStats> {
		const response = await api.get(`/api/dashboard/stats?days=${days}`);
		return response.data.data;
	}

	/**
	 * Get module statistics
	 */
	static async getModuleStats(days: number = 30): Promise<ModuleStats> {
		const response = await api.get(`/api/dashboard/stats/modules?days=${days}`);
		return response.data.data;
	}

	/**
	 * Get user statistics
	 */
	static async getUserStats(days: number = 30, limit: number = 10): Promise<UserStats> {
		const response = await api.get(`/api/dashboard/stats/users?days=${days}&limit=${limit}`);
		return response.data.data;
	}

	/**
	 * Get activity timeline
	 */
	static async getActivityTimeline(days: number = 30, interval: "hour" | "day" = "day"): Promise<ActivityTimeline> {
		const response = await api.get(`/api/dashboard/timeline?days=${days}&interval=${interval}`);
		return response.data.data;
	}

	/**
	 * Format file size for display
	 */
	static formatFileSize(bytes: number): string {
		if (bytes <= 0) return "0 B";

		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB", "TB"];

		let i = Math.floor(Math.log(bytes) / Math.log(k));

		// 1) 1 KB'den küçükse → 1 KB
		if (bytes < k) {
			return "1 KB";
		}

		const value = bytes / Math.pow(k, i);

		// 2) 1 GB'tan küçük (B, KB, MB) → ondalık yok
		if (i < 3) {
			// 0=B, 1=KB, 2=MB
			return `${Math.floor(value)} ${sizes[i]}`;
		}

		// 3) GB veya TB → tek ondalık
		let formatted = value.toFixed(1);

		// Eğer ".0" ile bitiyorsa → ondalığı at
		if (formatted.endsWith(".0")) {
			formatted = formatted.slice(0, -2);
		}

		return `${formatted} ${sizes[i]}`;
	}

	/**
	 * Get relative time string
	 */
	static getRelativeTime(date: string): string {
		const now = new Date();
		const activityDate = new Date(date);
		const diffInSeconds = Math.floor((now.getTime() - activityDate.getTime()) / 1000);

		if (diffInSeconds < 60) {
			return "just now";
		}

		const diffInMinutes = Math.floor(diffInSeconds / 60);
		if (diffInMinutes < 60) {
			return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
		}

		const diffInHours = Math.floor(diffInMinutes / 60);
		if (diffInHours < 24) {
			return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
		}

		const diffInDays = Math.floor(diffInHours / 24);
		if (diffInDays < 7) {
			return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
		}

		const diffInWeeks = Math.floor(diffInDays / 7);
		if (diffInWeeks < 4) {
			return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`;
		}

		const diffInMonths = Math.floor(diffInDays / 30);
		if (diffInMonths < 12) {
			return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""} ago`;
		}

		const diffInYears = Math.floor(diffInDays / 365);
		return `${diffInYears} year${diffInYears > 1 ? "s" : ""} ago`;
	}

	/**
	 * Get activity icon
	 */
	static getActivityIcon(action: string): React.ReactNode {
		switch (action) {
			case "create":
				return React.createElement(IconPlus, { className: "w-4 h-4" });
			case "update":
				return React.createElement(IconPencil, { className: "w-4 h-4" });
			case "delete":
				return React.createElement(IconTrash, { className: "w-4 h-4" });
			case "restore":
				return React.createElement(IconRestore, { className: "w-4 h-4" });
			case "permanentlyDelete":
				return React.createElement(IconTrashOff, { className: "w-4 h-4" });
			case "publish":
				return React.createElement(IconEye, { className: "w-4 h-4" });
			case "unpublish":
				return React.createElement(IconEyeOff, { className: "w-4 h-4" });
			case "upload":
				return React.createElement(IconUpload, { className: "w-4 h-4" });
			case "move":
				return React.createElement(IconArrowsMove, { className: "w-4 h-4" });
			case "copy":
				return React.createElement(IconCopy, { className: "w-4 h-4" });
			default:
				return React.createElement(IconNotes, { className: "w-4 h-4" });
		}
	}

	/**
	 * Get activity color
	 */
	static getActivityColor(action: string): string {
		switch (action) {
			// case "create":
			// 	return "text-green-600 bg-green-50 border border-green-100";
			// case "update":
			// 	return "text-blue-600 bg-blue-50 border border-blue-100";
			// case "delete":
			// 	return "text-red-600 bg-red-50 border border-red-100";
			// case "permanentlyDelete":
			// 	return "text-red-600 bg-red-50 border border-red-100";
			// case "publish":
			// 	return "text-green-600 bg-green-50 border border-green-100";
			// case "unpublish":
			// 	return "text-orange-600 bg-orange-50 border border-orange-100";
			// case "upload":
			// 	return "text-purple-600 bg-purple-50 border border-purple-100";
			// case "move":
			// 	return "text-indigo-600 bg-indigo-50 border border-indigo-100";
			// case "copy":
			// 	return "text-cyan-600 bg-cyan-50 border border-cyan-100";
			default:
				return "text-gray-600 bg-white";
		}
	}

	/**
	 * Format module name for display
	 */
	static formatModuleName(module: string): string {
		switch (module) {
			case "works":
				return "Works";
			case "photography":
				return "Photography";
			case "media":
				return "Media Gallery";
			case "homepage":
				return "Homepage";
			case "content":
				return "Content Pages";
			case "users":
				return "Users";
			default:
				return module.charAt(0).toUpperCase() + module.slice(1);
		}
	}

	/**
	 * Derive a human-friendly display name from activity metadata.
	 * Tries common fields like originalName, fileName, filename, name, title, or basename of path.
	 */
	static getDisplayNameFromMetadata(metadata?: Record<string, unknown>): string | null {
		if (!metadata) return null;

		const tryFrom = (obj: Record<string, unknown> | undefined | null): string | null => {
			if (!obj) return null;
			const candidates = ["originalName", "originalFilename", "fileName", "filename", "name", "title"];
			for (const key of candidates) {
				const v = obj[key];
				if (typeof v === "string" && v.trim()) return v.trim();
			}
			const pathVal = obj["path"];
			if (typeof pathVal === "string" && pathVal) {
				const parts = pathVal.split(/[\\/]+/);
				const base = parts[parts.length - 1];
				if (base) return base;
			}
			return null;
		};

		// direct metadata keys
		let name = tryFrom(metadata);
		if (name) return name;

		// nested file object
		const maybeFile = metadata["file"];
		const fileObj =
			typeof maybeFile === "object" && maybeFile !== null ? (maybeFile as Record<string, unknown>) : undefined;
		name = tryFrom(fileObj);
		if (name) return name;

		return null;
	}

	/**
	 * Get improved display title for activity. If the server-provided title is generic (e.g., "File 17"),
	 * prefer a filename from metadata when available.
	 */
	static getActivityDisplayTitle(activity: Activity): string {
		const genericFileTitle = /^(file|dosya)\s*#?\d+$/i;
		const looksGeneric = genericFileTitle.test(activity.title);
		const candidate = this.getDisplayNameFromMetadata(activity.metadata);

		// Prefer metadata filename for media/file-like activities or when title looks generic
		const isFileLike =
			["file", "image", "video", "document"].includes((activity.itemType || "").toLowerCase()) ||
			activity.module === "media";

		if ((isFileLike || looksGeneric) && candidate) {
			return candidate;
		}

		return activity.title;
	}

	/**
	 * Get formatted activity title
	 */
	static getActivityTitle(activity: Activity): string {
		const { action, itemType, title } = activity;

		let actionText = action;
		switch (action) {
			case "create":
				actionText = "created";
				break;
			case "update":
				actionText = "updated";
				break;
			case "delete":
				actionText = "deleted";
				break;
			case "publish":
				actionText = "published";
				break;
			case "unpublish":
				actionText = "unpublished";
				break;
			case "upload":
				actionText = "uploaded";
				break;
			case "move":
				actionText = "moved";
				break;
			case "copy":
				actionText = "copied";
				break;
		}

		return `${title} ${itemType} has been ${actionText}`;
	}
}
