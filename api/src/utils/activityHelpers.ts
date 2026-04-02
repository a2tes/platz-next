import { ActivityQueryOptions } from "../services/activityService";

/**
 * Activity filter builder utility
 */
export class ActivityFilterBuilder {
	private filters: ActivityQueryOptions = {};

	/**
	 * Filter by user ID
	 */
	byUser(userId: number): ActivityFilterBuilder {
		this.filters.userId = userId;
		return this;
	}

	/**
	 * Filter by module
	 */
	byModule(module: string): ActivityFilterBuilder {
		this.filters.module = module;
		return this;
	}

	/**
	 * Filter by item type
	 */
	byItemType(itemType: string): ActivityFilterBuilder {
		this.filters.itemType = itemType;
		return this;
	}

	/**
	 * Filter by action
	 */
	byAction(action: string): ActivityFilterBuilder {
		this.filters.action = action as any;
		return this;
	}

	/**
	 * Filter by date range
	 */
	byDateRange(startDate: Date, endDate?: Date): ActivityFilterBuilder {
		this.filters.startDate = startDate;
		if (endDate) {
			this.filters.endDate = endDate;
		}
		return this;
	}

	/**
	 * Filter by last N days
	 */
	byLastDays(days: number): ActivityFilterBuilder {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
		this.filters.startDate = startDate;
		return this;
	}

	/**
	 * Set pagination
	 */
	paginate(page: number, limit: number): ActivityFilterBuilder {
		this.filters.page = page;
		this.filters.limit = limit;
		return this;
	}

	/**
	 * Build the filter options
	 */
	build(): ActivityQueryOptions {
		return { ...this.filters };
	}

	/**
	 * Reset all filters
	 */
	reset(): ActivityFilterBuilder {
		this.filters = {};
		return this;
	}
}

/**
 * Activity time helpers
 */
export class ActivityTimeHelpers {
	/**
	 * Get relative time string (e.g., "2 hours ago", "just now")
	 */
	static getRelativeTime(date: Date): string {
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

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
	 * Get formatted date string
	 */
	static getFormattedDate(date: Date): string {
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	/**
	 * Get date range for common periods
	 */
	static getDateRange(period: "today" | "yesterday" | "week" | "month" | "year"): { start: Date; end: Date } {
		const now = new Date();
		const start = new Date();
		const end = new Date();

		switch (period) {
			case "today":
				start.setHours(0, 0, 0, 0);
				end.setHours(23, 59, 59, 999);
				break;

			case "yesterday":
				start.setDate(now.getDate() - 1);
				start.setHours(0, 0, 0, 0);
				end.setDate(now.getDate() - 1);
				end.setHours(23, 59, 59, 999);
				break;

			case "week":
				const dayOfWeek = now.getDay();
				start.setDate(now.getDate() - dayOfWeek);
				start.setHours(0, 0, 0, 0);
				end.setHours(23, 59, 59, 999);
				break;

			case "month":
				start.setDate(1);
				start.setHours(0, 0, 0, 0);
				end.setMonth(now.getMonth() + 1, 0);
				end.setHours(23, 59, 59, 999);
				break;

			case "year":
				start.setMonth(0, 1);
				start.setHours(0, 0, 0, 0);
				end.setMonth(11, 31);
				end.setHours(23, 59, 59, 999);
				break;
		}

		return { start, end };
	}
}

/**
 * Activity formatting helpers
 */
export class ActivityFormatHelpers {
	/**
	 * Format activity description with user name and time
	 */
	static formatDescription(activity: any): string {
		const timeAgo = ActivityTimeHelpers.getRelativeTime(new Date(activity.createdAt));
		const userName = activity.user?.name || "Unknown User";

		switch (activity.action) {
			case "create":
				return `Created ${timeAgo} by ${userName}`;
			case "update":
				return `Updated ${timeAgo} by ${userName}`;
			case "delete":
				return `Deleted ${timeAgo} by ${userName}`;
			case "publish":
				return `Published ${timeAgo} by ${userName}`;
			case "unpublish":
				return `Unpublished ${timeAgo} by ${userName}`;
			case "upload":
				return `Uploaded ${timeAgo} by ${userName}`;
			case "move":
				return `Moved ${timeAgo} by ${userName}`;
			case "copy":
				return `Copied ${timeAgo} by ${userName}`;
			default:
				return `${activity.action} ${timeAgo} by ${userName}`;
		}
	}

	/**
	 * Get activity icon based on action
	 */
	static getActivityIcon(action: string): string {
		switch (action) {
			case "create":
				return "plus";
			case "update":
				return "edit";
			case "delete":
				return "trash";
			case "restore":
				return "restore";
			case "permanentlyDelete":
				return "trashOff";
			case "publish":
				return "eye";
			case "unpublish":
				return "eye-off";
			case "upload":
				return "upload";
			case "move":
				return "move";
			case "copy":
				return "copy";
			default:
				return "activity";
		}
	}

	/**
	 * Format module name for display
	 */
	static formatModuleName(module: string): string {
		switch (module) {
			case "works":
				return "Works";
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
	 * Format item type for display
	 */
	static formatItemType(itemType: string): string {
		switch (itemType) {
			case "work":
				return "Work";

			case "category":
				return "Category";
			case "file":
				return "File";
			case "folder":
				return "Folder";
			case "page":
				return "Page";
			case "user":
				return "User";
			case "configuration":
				return "Configuration";
			default:
				return itemType.charAt(0).toUpperCase() + itemType.slice(1);
		}
	}
}

/**
 * Activity search helpers
 */
export class ActivitySearchHelpers {
	/**
	 * Parse search query and return filter options
	 */
	static parseSearchQuery(query: string): Partial<ActivityQueryOptions> {
		const filters: Partial<ActivityQueryOptions> = {};

		// Split query into terms
		const terms = query
			.toLowerCase()
			.split(" ")
			.filter((term) => term.length > 0);

		for (const term of terms) {
			// Check for module filters
			if (term.startsWith("module:")) {
				filters.module = term.replace("module:", "");
				continue;
			}

			// Check for action filters
			if (term.startsWith("action:")) {
				filters.action = term.replace("action:", "") as any;
				continue;
			}

			// Check for type filters
			if (term.startsWith("type:")) {
				filters.itemType = term.replace("type:", "");
				continue;
			}

			// Check for date filters
			if (term.startsWith("date:")) {
				const dateValue = term.replace("date:", "");
				const dateRange = ActivityTimeHelpers.getDateRange(dateValue as any);
				if (dateRange) {
					filters.startDate = dateRange.start;
					filters.endDate = dateRange.end;
				}
				continue;
			}
		}

		return filters;
	}

	/**
	 * Get search suggestions based on partial query
	 */
	static getSearchSuggestions(query: string): string[] {
		const suggestions: string[] = [];
		const lowerQuery = query.toLowerCase();

		// Module suggestions
		const modules = ["works", "media", "homepage", "content", "users"];
		modules.forEach((module) => {
			if (module.includes(lowerQuery)) {
				suggestions.push(`module:${module}`);
			}
		});

		// Action suggestions
		const actions = ["create", "update", "delete", "publish", "unpublish", "upload", "move"];
		actions.forEach((action) => {
			if (action.includes(lowerQuery)) {
				suggestions.push(`action:${action}`);
			}
		});

		// Type suggestions
		const types = ["work", "file", "folder", "page"];
		types.forEach((type) => {
			if (type.includes(lowerQuery)) {
				suggestions.push(`type:${type}`);
			}
		});

		// Date suggestions
		const dates = ["today", "yesterday", "week", "month", "year"];
		dates.forEach((date) => {
			if (date.includes(lowerQuery)) {
				suggestions.push(`date:${date}`);
			}
		});

		return suggestions.slice(0, 10); // Limit to 10 suggestions
	}
}

/**
 * Create a new activity filter builder
 */
export const createActivityFilter = (): ActivityFilterBuilder => {
	return new ActivityFilterBuilder();
};
