import { Request, Response } from "express";
import { ActivityService } from "../services/activityService";
import { createActivityFilter, ActivityTimeHelpers } from "../utils/activityHelpers";
import { ApiResponse } from "../utils/apiResponse";
import { prisma } from "../config/database";

/**
 * Dashboard controller
 */
export class DashboardController {
	/**
	 * Get all activities (admin view)
	 * GET /api/dashboard/activities/all
	 */
	static async getAllActivities(req: Request, res: Response) {
		try {
			const { page = 1, limit = 10, module, action, itemType, startDate, endDate, search } = req.query;

			// Build filter
			const filter = createActivityFilter().paginate(Number(page), Number(limit));

			if (module) filter.byModule(module as string);
			if (action) filter.byAction(action as string);
			if (itemType) filter.byItemType(itemType as string);

			if (startDate) {
				const start = new Date(startDate as string);
				const end = endDate ? new Date(endDate as string) : new Date();
				filter.byDateRange(start, end);
			}

			const result = await ActivityService.getActivities(filter.build());

			// Format activities for display
			const formattedActivities = result.activities.map((activity: any) => {
				const capitalized = activity.action ? activity.action.charAt(0).toUpperCase() + activity.action.slice(1) : "";
				const description = activity.description && activity.description.trim() ? activity.description : capitalized;

				return {
					id: activity.id,
					title: activity.itemTitle,
					description,
					module: activity.module,
					itemType: activity.itemType,
					action: activity.action,
					user: {
						id: activity.user.id,
						name: activity.user.name,
						email: activity.user.email,
					},
					createdAt: activity.createdAt,
					metadata: activity.metadata,
				};
			});

			return ApiResponse.success(res, {
				activities: formattedActivities,
				pagination: {
					page: result.page,
					limit: result.limit,
					total: result.total,
					totalPages: result.totalPages,
				},
			});
		} catch (error) {
			console.error("Error fetching all activities:", error);
			return ApiResponse.internalError(res, "Failed to fetch activities");
		}
	}

	/**
	 * Get user's activities (my activity view)
	 * GET /api/dashboard/activities/my
	 */
	static async getMyActivities(req: Request, res: Response) {
		try {
			if (!req.user) {
				return ApiResponse.unauthorized(res, "User not authenticated");
			}

			const { page = 1, limit = 20, module, action, itemType, startDate, endDate } = req.query;

			// Build filter for current user
			const filter = createActivityFilter().byUser(req.user.id).paginate(Number(page), Number(limit));

			if (module) filter.byModule(module as string);
			if (action) filter.byAction(action as string);
			if (itemType) filter.byItemType(itemType as string);

			if (startDate) {
				const start = new Date(startDate as string);
				const end = endDate ? new Date(endDate as string) : new Date();
				filter.byDateRange(start, end);
			}

			const result = await ActivityService.getActivities(filter.build());

			// Format activities for display
			const formattedActivities = result.activities.map((activity: any) => {
				const capitalized = activity.action ? activity.action.charAt(0).toUpperCase() + activity.action.slice(1) : "";
				const description = activity.description && activity.description.trim() ? activity.description : capitalized;
				return {
					id: activity.id,
					title: activity.itemTitle,
					description,
					module: activity.module,
					itemType: activity.itemType,
					action: activity.action,
					createdAt: activity.createdAt,
					metadata: activity.metadata,
				};
			});

			return ApiResponse.success(res, {
				activities: formattedActivities,
				pagination: {
					page: result.page,
					limit: result.limit,
					total: result.total,
					totalPages: result.totalPages,
				},
			});
		} catch (error) {
			console.error("Error fetching user activities:", error);
			return ApiResponse.internalError(res, "Failed to fetch activities");
		}
	}

	/**
	 * Get dashboard statistics
	 * GET /api/dashboard/stats
	 */
	static async getDashboardStats(req: Request, res: Response) {
		try {
			const { days = 30 } = req.query;
			const daysNumber = Number(days);

			// Get date range
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - daysNumber);

			// Get activity stats
			const activityStats = await ActivityService.getActivityStats(undefined, daysNumber);

			// Get total counts for different modules
			const [
				totalWorks,
				totalMediaFiles,
				totalUsers,
				// recentActivities,
			] = await Promise.all([
				prisma.work.count(),
				prisma.mediaFile.count(),
				prisma.user.count(),
				ActivityService.getActivities({ limit: 5 }),
			]);

			// Get published vs draft counts
			const [publishedWorks, draftWorks] = await Promise.all([
				prisma.work.count({ where: { status: "PUBLISHED" } }),
				prisma.work.count({ where: { status: "DRAFT" } }),
			]);

			// Users: migration applied — use status field directly
			const [publishedUsers, draftUsers] = await Promise.all([
				prisma.user.count({ where: { status: "PUBLISHED" } as any }),
				prisma.user.count({ where: { status: "DRAFT" } as any }),
			]);

			// Get storage stats
			const storageStats = await prisma.mediaFile.aggregate({
				_sum: {
					size: true,
				},
			});

			// Convert BigInt to number for JSON serialization
			const totalStorageSize = storageStats._sum.size ? Number(storageStats._sum.size) : 0;

			return ApiResponse.success(res, {
				contentStats: {
					works: {
						published: publishedWorks,
						draft: draftWorks,
						total: totalWorks,
					},
					users: {
						published: publishedUsers,
						draft: draftUsers,
						total: totalUsers,
					},
					mediaFiles: {
						total: totalMediaFiles,
						storageSize: totalStorageSize,
					},
				},
				activityStats: {
					period: `${daysNumber} days`,
					stats: activityStats,
					totalActivities: activityStats.reduce((sum: number, stat: any) => sum + stat.count, 0),
				},
			});
		} catch (error) {
			console.error("Error fetching dashboard stats:", error);
			return ApiResponse.internalError(res, "Failed to fetch dashboard statistics");
		}
	}

	/**
	 * Get activity statistics by module
	 * GET /api/dashboard/stats/modules
	 */
	static async getModuleStats(req: Request, res: Response) {
		try {
			const { days = 30 } = req.query;
			const daysNumber = Number(days);

			const activityStats = await ActivityService.getActivityStats(undefined, daysNumber);

			// Group by module
			const moduleStats = activityStats.reduce((acc: any, stat: any) => {
				if (!acc[stat.module]) {
					acc[stat.module] = {
						module: stat.module,
						totalActivities: 0,
						actions: {},
					};
				}

				acc[stat.module].totalActivities += stat.count;
				acc[stat.module].actions[stat.action] = stat.count;

				return acc;
			}, {});

			return ApiResponse.success(res, {
				period: `${daysNumber} days`,
				modules: Object.values(moduleStats),
			});
		} catch (error) {
			console.error("Error fetching module stats:", error);
			return ApiResponse.internalError(res, "Failed to fetch module statistics");
		}
	}

	/**
	 * Get user activity statistics
	 * GET /api/dashboard/stats/users
	 */
	static async getUserStats(req: Request, res: Response) {
		try {
			const { days = 30, limit = 10 } = req.query;
			const daysNumber = Number(days);
			const limitNumber = Number(limit);

			const startDate = new Date();
			startDate.setDate(startDate.getDate() - daysNumber);

			// Get user activity counts
			const userActivities = await prisma.activity.groupBy({
				by: ["userId"],
				where: {
					createdAt: {
						gte: startDate,
					},
				},
				_count: {
					id: true,
				},
				orderBy: {
					_count: {
						id: "desc",
					},
				},
				take: limitNumber,
			});

			// Get user details
			const userIds = userActivities.map((ua: any) => ua.userId);
			const users = await prisma.user.findMany({
				where: {
					id: {
						in: userIds,
					},
				},
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
				},
			});

			// Combine user data with activity counts
			const userStats = userActivities.map((ua: any) => {
				const user = users.find((u) => u.id === ua.userId);
				return {
					user: user || {
						id: ua.userId,
						name: "Unknown User",
						email: "",
						role: "VIEWER",
					},
					activityCount: ua._count.id,
				};
			});

			return ApiResponse.success(res, {
				period: `${daysNumber} days`,
				users: userStats,
			});
		} catch (error) {
			console.error("Error fetching user stats:", error);
			return ApiResponse.internalError(res, "Failed to fetch user statistics");
		}
	}

	/**
	 * Get activity timeline (for charts)
	 * GET /api/dashboard/timeline
	 */
	static async getActivityTimeline(req: Request, res: Response) {
		try {
			const { days = 30, interval = "day" } = req.query;
			const daysNumber = Number(days);

			const startDate = new Date();
			startDate.setDate(startDate.getDate() - daysNumber);

			// Get activities grouped by date
			const activities = await prisma.activity.findMany({
				where: {
					createdAt: {
						gte: startDate,
					},
				},
				select: {
					createdAt: true,
					action: true,
					module: true,
				},
				orderBy: {
					createdAt: "asc",
				},
			});

			// Group activities by date/hour based on interval
			const timeline: any = {};

			activities.forEach((activity: any) => {
				let key: string;
				const date = new Date(activity.createdAt);

				if (interval === "hour") {
					key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
						date.getDate(),
					).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`;
				} else {
					key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
						date.getDate(),
					).padStart(2, "0")}`;
				}

				if (!timeline[key]) {
					timeline[key] = {
						date: key,
						total: 0,
						actions: {},
						modules: {},
					};
				}

				timeline[key].total++;
				timeline[key].actions[activity.action] = (timeline[key].actions[activity.action] || 0) + 1;
				timeline[key].modules[activity.module] = (timeline[key].modules[activity.module] || 0) + 1;
			});

			return ApiResponse.success(res, {
				period: `${daysNumber} days`,
				interval,
				timeline: Object.values(timeline),
			});
		} catch (error) {
			console.error("Error fetching activity timeline:", error);
			return ApiResponse.internalError(res, "Failed to fetch activity timeline");
		}
	}
}
