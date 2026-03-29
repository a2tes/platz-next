import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
	createUser,
	getUsers as svcGetUsers,
	updateUser as svcUpdateUser,
	deleteUser as svcDeleteUser,
	updateUserStatus as svcUpdateUserStatus,
	getTrashedUsers as svcGetTrashedUsers,
	restoreUser as svcRestoreUser,
} from "../services/userService";
import {
	createUserSchema,
	updateUserSchema,
	getUsersQuerySchema,
	updateUserStatusSchema,
} from "../utils/validation";

// Common API response helpers
const apiResponse = {
	success: (data: any, meta?: any) => ({
		success: true,
		data,
		meta: { timestamp: new Date().toISOString(), ...meta },
	}),
	error: (message: string, code: string) => ({
		success: false,
		error: {
			code,
			message,
			timestamp: new Date().toISOString(),
		},
	}),
};

export class UsersController {
	/**
	 * GET /api/users
	 */
	static async getUsers(req: Request, res: Response, next: NextFunction) {
		try {
			const query = getUsersQuerySchema.parse({
				page: req.query.page,
				limit: req.query.limit,
				search: req.query.search,
				role: req.query.role,
				status: req.query.status,
			});

			const result = await svcGetUsers(
				query.page,
				query.limit,
				query.search,
				query.role as any,
				query.status as any
			);

			res.json(
				apiResponse.success(result.users, {
					pagination: {
						page: result.page,
						limit: result.limit,
						total: result.total,
						totalPages: result.totalPages,
					},
				})
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/users
	 */
	static async createUser(req: Request, res: Response, next: NextFunction) {
		try {
			const payload = createUserSchema.parse(req.body);
			const user = await createUser(payload);
			res.status(201).json(apiResponse.success({ user }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/users/:id
	 */
	static async updateUser(req: Request, res: Response, next: NextFunction) {
		try {
			const id = z.coerce.number().parse(req.params.id);
			const payload = updateUserSchema.parse(req.body);
			const updated = await svcUpdateUser(id, payload, req.user!.id);
			res.json(apiResponse.success({ user: updated }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/users/:id/status
	 */
	static async updateUserStatus(
		req: Request,
		res: Response,
		next: NextFunction
	) {
		try {
			const id = z.coerce.number().parse(req.params.id);
			const payload = updateUserStatusSchema.parse(req.body);
			const updated = await svcUpdateUserStatus(id, payload.status as any);
			res.json(apiResponse.success({ user: updated }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /api/users/:id
	 */
	static async deleteUser(req: Request, res: Response, next: NextFunction) {
		try {
			const id = z.coerce.number().parse(req.params.id);
			// Prevent self-delete
			if (req.user && req.user.id === id) {
				return res
					.status(400)
					.json(
						apiResponse.error(
							"You cannot delete your own account",
							"CANNOT_DELETE_SELF"
						)
					);
			}
			await svcDeleteUser(id);
			res.json(apiResponse.success({ message: "User deleted" }));
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/users/trash
	 */
	static async getTrashed(req: Request, res: Response, next: NextFunction) {
		try {
			const query = getUsersQuerySchema
				.pick({ page: true, limit: true, search: true })
				.parse({
					page: req.query.page,
					limit: req.query.limit,
					search: req.query.search,
				});

			const result = await svcGetTrashedUsers(
				query.page,
				query.limit,
				query.search
			);

			res.json(
				apiResponse.success(result.users, {
					pagination: {
						page: result.page,
						limit: result.limit,
						total: result.total,
						totalPages: result.totalPages,
					},
				})
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/users/:id/restore
	 */
	static async restore(req: Request, res: Response, next: NextFunction) {
		try {
			const id = z.coerce.number().parse(req.params.id);
			const user = await svcRestoreUser(id);
			res.json(apiResponse.success({ user }));
		} catch (error) {
			next(error);
		}
	}
}
