import { prisma } from "../config/database";
import { User } from "@prisma/client";

/**
 * Activity action types
 */
export type ActivityAction =
	| "create"
	| "update"
	| "delete"
	| "restore"
	| "permanentlyDelete"
	| "publish"
	| "unpublish"
	| "upload"
	| "move"
	| "copy";

/**
 * Activity log entry interface
 */
export interface ActivityLogEntry {
	userId: number;
	action: ActivityAction;
	module: string;
	itemType: string;
	itemId: number;
	itemTitle: string;
	description?: string;
	metadata?: Record<string, any>;
}

/**
 * Activity query options
 */
export interface ActivityQueryOptions {
	userId?: number;
	module?: string;
	itemType?: string;
	action?: ActivityAction;
	page?: number;
	limit?: number;
	startDate?: Date;
	endDate?: Date;
}

/**
 * Activity service for logging and retrieving user activities
 */
export class ActivityService {
	/**
	 * Log an activity
	 */
	static async log(entry: ActivityLogEntry): Promise<void> {
		try {
			const description = entry.description || this.generateDescription(entry);

			await prisma.activity.create({
				data: {
					userId: entry.userId,
					action: entry.action,
					module: entry.module,
					itemType: entry.itemType,
					itemId: entry.itemId,
					itemTitle: entry.itemTitle,
					description,
					metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
				},
			});
		} catch (error) {
			console.error("Failed to log activity:", error);
			// Don't throw error to avoid breaking the main operation
		}
	}

	/**
	 * Log multiple activities
	 */
	static async logMany(entries: ActivityLogEntry[]): Promise<void> {
		try {
			if (entries.length === 0) return;

			const data = entries.map((entry) => ({
				userId: entry.userId,
				action: entry.action,
				module: entry.module,
				itemType: entry.itemType,
				itemId: entry.itemId,
				itemTitle: entry.itemTitle,
				description: entry.description || this.generateDescription(entry),
				metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
			}));

			await prisma.activity.createMany({
				data,
			});
		} catch (error) {
			console.error("Failed to log activities:", error);
		}
	}

	/**
	 * Log creation activity
	 */
	static async logCreate(
		userId: number,
		module: string,
		itemType: string,
		itemId: number,
		itemTitle: string,
		metadata?: Record<string, any>
	): Promise<void> {
		await this.log({
			userId,
			action: "create",
			module,
			itemType,
			itemId,
			itemTitle,
			metadata,
		});
	}

	/**
	 * Log update activity
	 */
	static async logUpdate(
		userId: number,
		module: string,
		itemType: string,
		itemId: number,
		itemTitle: string,
		changes?: Record<string, any>
	): Promise<void> {
		await this.log({
			userId,
			action: "update",
			module,
			itemType,
			itemId,
			itemTitle,
			metadata: changes ? { changes } : undefined,
		});
	}

	/**
	 * Log deletion activity
	 */
	static async logDelete(
		userId: number,
		module: string,
		itemType: string,
		itemId: number,
		itemTitle: string
	): Promise<void> {
		await this.log({
			userId,
			action: "delete",
			module,
			itemType,
			itemId,
			itemTitle,
		});
	}

	/**
	 * Log publish activity
	 */
	static async logPublish(
		userId: number,
		module: string,
		itemType: string,
		itemId: number,
		itemTitle: string
	): Promise<void> {
		await this.log({
			userId,
			action: "publish",
			module,
			itemType,
			itemId,
			itemTitle,
		});
	}

	/**
	 * Log unpublish activity
	 */
	static async logUnpublish(
		userId: number,
		module: string,
		itemType: string,
		itemId: number,
		itemTitle: string
	): Promise<void> {
		await this.log({
			userId,
			action: "unpublish",
			module,
			itemType,
			itemId,
			itemTitle,
		});
	}

	/**
	 * Log file upload activity
	 */
	static async logUpload(
		userId: number,
		fileName: string,
		fileId: number,
		metadata?: Record<string, any>
	): Promise<void> {
		await this.log({
			userId,
			action: "upload",
			module: "media",
			itemType: "file",
			itemId: fileId,
			itemTitle: fileName,
			metadata,
		});
	}

	/**
	 * Get activities with filtering and pagination
	 */
	static async getActivities(options: ActivityQueryOptions = {}) {
		const {
			userId,
			module,
			itemType,
			action,
			page = 1,
			limit = 10,
			startDate,
			endDate,
		} = options;

		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = {};

		if (userId) where.userId = userId;
		if (module) where.module = module;
		if (itemType) where.itemType = itemType;
		if (action) where.action = action;

		if (startDate || endDate) {
			where.createdAt = {};
			if (startDate) where.createdAt.gte = startDate;
			if (endDate) where.createdAt.lte = endDate;
		}

		// Get activities with user information
		const [activities, total] = await Promise.all([
			prisma.activity.findMany({
				where,
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
				skip,
				take: limit,
			}),
			prisma.activity.count({ where }),
		]);

		return {
			activities: activities.map((activity: any) => ({
				...activity,
				metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
			})),
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	/**
	 * Get user's recent activities
	 */
	static async getUserActivities(userId: number, limit: number = 10) {
		return this.getActivities({ userId, limit });
	}

	/**
	 * Get all recent activities
	 */
	static async getAllActivities(limit: number = 10) {
		return this.getActivities({ limit });
	}

	/**
	 * Get activities by module
	 */
	static async getModuleActivities(module: string, limit: number = 10) {
		return this.getActivities({ module, limit });
	}

	/**
	 * Get activity statistics
	 */
	static async getActivityStats(userId?: number, days: number = 30) {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const where: any = {
			createdAt: {
				gte: startDate,
			},
		};

		if (userId) where.userId = userId;

		const stats = await prisma.activity.groupBy({
			by: ["action", "module"],
			where,
			_count: {
				id: true,
			},
		});

		return stats.map((stat: any) => ({
			action: stat.action,
			module: stat.module,
			count: stat._count.id,
		}));
	}

	/**
	 * Clean up old activities (older than specified days)
	 */
	static async cleanupOldActivities(days: number = 90): Promise<number> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);

		const result = await prisma.activity.deleteMany({
			where: {
				createdAt: {
					lt: cutoffDate,
				},
			},
		});

		return result.count;
	}

	/**
	 * Generate activity description
	 */
	private static generateDescription(entry: ActivityLogEntry): string {
		// Keep descriptions neutral; UI will show user/time separately
		switch (entry.action) {
			case "create":
				return "Created";
			case "update":
				return "Updated";
			case "delete":
				return "Deleted";
			case "publish":
				return "Published";
			case "unpublish":
				return "Unpublished";
			case "upload":
				return "Uploaded";
			case "move":
				return "Moved";
			case "copy":
				return "Copied";
			default:
				return entry.action;
		}
	}
}

/**
 * Activity logging middleware
 * Automatically logs CRUD operations
 */
export const activityLogger = (
	module: string,
	itemType: string,
	options: {
		getItemId?: (req: any) => number;
		getItemTitle?: (req: any, result?: any) => string;
		skipActions?: ActivityAction[];
	} = {}
) => {
	return (req: any, res: any, next: any) => {
		const originalSend = res.send;

		res.send = function (body: any) {
			// Only log successful operations (2xx status codes)
			if (res.statusCode >= 200 && res.statusCode < 300) {
				const user = req.user;
				if (user) {
					// Determine action based on HTTP method
					let action: ActivityAction;
					switch (req.method) {
						case "POST":
							action = "create";
							break;
						case "PUT":
						case "PATCH":
							action = "update";
							break;
						case "DELETE":
							action = "delete";
							break;
						default:
							return originalSend.call(this, body);
					}

					// Skip if action is in skipActions
					if (options.skipActions?.includes(action)) {
						return originalSend.call(this, body);
					}

					// Get item ID and title
					const itemId = options.getItemId
						? options.getItemId(req)
						: parseInt(req.params.id as string);
					const itemTitle = options.getItemTitle
						? options.getItemTitle(req, body)
						: `${itemType} #${itemId}`;

					// Log activity asynchronously
					if (itemId && !isNaN(itemId)) {
						ActivityService.log({
							userId: user.id,
							action,
							module,
							itemType,
							itemId,
							itemTitle,
						}).catch((error) => {
							console.error("Failed to log activity:", error);
						});
					}
				}
			}

			return originalSend.call(this, body);
		};

		next();
	};
};
