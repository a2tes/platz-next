import { api } from "@/lib/api";
import type { ApiResponse } from "@/types";

export type AdminUser = {
	id: number;
	email: string;
	name: string;
	role: "ADMIN" | "EDITOR" | "VIEWER";
	status: "DRAFT" | "PUBLISHED";
	createdAt: string;
	updatedAt: string;
};

export type Paginated<T> = {
	data: T[];
	meta: {
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	};
};

export class AdminUsersService {
	static async getUsers(params: {
		page?: number;
		limit?: number;
		search?: string;
		role?: "ADMIN" | "EDITOR" | "VIEWER";
		status?: "DRAFT" | "PUBLISHED";
	}): Promise<Paginated<AdminUser>> {
		const response = await api.get<ApiResponse<AdminUser[]>>("/api/users", {
			params,
		});

		const pagination = response.data.meta?.pagination || {
			page: params.page ?? 1,
			limit: params.limit ?? 20,
			total: response.data.data?.length || 0,
			totalPages: 1,
		};

		return {
			data: response.data.data || [],
			meta: { pagination },
		};
	}

	static async createUser(payload: {
		name: string;
		email: string;
		password: string;
		role?: "ADMIN" | "EDITOR" | "VIEWER";
		status?: "DRAFT" | "PUBLISHED";
	}): Promise<AdminUser> {
		const response = await api.post<ApiResponse<{ user: AdminUser }>>(
			"/api/users",
			payload
		);
		return response.data.data!.user;
	}

	static async updateUser(
		id: number,
		payload: Partial<{
			name: string;
			email: string;
			role: "ADMIN" | "EDITOR" | "VIEWER";
			status: "DRAFT" | "PUBLISHED";
		}>
	): Promise<AdminUser> {
		const response = await api.patch<ApiResponse<{ user: AdminUser }>>(
			`/api/users/${id}`,
			payload
		);
		return response.data.data!.user;
	}

	static async setStatus(
		id: number,
		status: "DRAFT" | "PUBLISHED"
	): Promise<AdminUser> {
		const response = await api.patch<ApiResponse<{ user: AdminUser }>>(
			`/api/users/${id}/status`,
			{ status }
		);
		return response.data.data!.user;
	}

	static async deleteUser(id: number): Promise<void> {
		await api.delete<ApiResponse<{ message: string }>>(`/api/users/${id}`);
	}

	static async getTrashedUsers(params: {
		page?: number;
		limit?: number;
		search?: string;
	}): Promise<Paginated<AdminUser>> {
		const response = await api.get<ApiResponse<AdminUser[]>>(
			"/api/users/trash",
			{ params }
		);
		const pagination = response.data.meta?.pagination || {
			page: params.page ?? 1,
			limit: params.limit ?? 20,
			total: response.data.data?.length || 0,
			totalPages: 1,
		};
		return { data: response.data.data || [], meta: { pagination } };
	}

	static async restoreUser(id: number): Promise<AdminUser> {
		const response = await api.patch<ApiResponse<{ user: AdminUser }>>(
			`/api/users/${id}/restore`,
			{}
		);
		return response.data.data!.user;
	}

	static async getCounts(): Promise<{
		all: number;
		active: number;
		inactive: number;
		trash: number;
	}> {
		const [allRes, activeRes, inactiveRes, trashRes]: [
			{ data: ApiResponse<AdminUser[]> },
			{ data: ApiResponse<AdminUser[]> },
			{ data: ApiResponse<AdminUser[]> },
			{ data: ApiResponse<AdminUser[]> }
		] = await Promise.all([
			api.get<ApiResponse<AdminUser[]>>("/api/users", {
				params: { page: 1, limit: 1 },
			}),
			api.get<ApiResponse<AdminUser[]>>("/api/users", {
				params: { page: 1, limit: 1, status: "PUBLISHED" },
			}),
			api.get<ApiResponse<AdminUser[]>>("/api/users", {
				params: { page: 1, limit: 1, status: "DRAFT" },
			}),
			api.get<ApiResponse<AdminUser[]>>("/api/users/trash", {
				params: { page: 1, limit: 1 },
			}),
		]);

		const getTotal = (res: { data: ApiResponse<AdminUser[]> }) =>
			res.data.meta?.pagination?.total ?? res.data.data?.length ?? 0;

		return {
			all: getTotal(allRes),
			active: getTotal(activeRes),
			inactive: getTotal(inactiveRes),
			trash: getTotal(trashRes),
		};
	}
}
