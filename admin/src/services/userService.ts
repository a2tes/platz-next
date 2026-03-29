import { api } from "../lib/api";
import type { ApiResponse } from "../types";
import type { User } from "../types/auth";

export type UpdateMePayload = {
	name?: string;
	email?: string;
	// Optional; included for compatibility, but avatar crop is saved via MediaService.crops
	avatarMediaId?: number | null;
};

export type ChangeMyPasswordPayload = {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
};

export class UserService {
	static async updateMe(data: UpdateMePayload): Promise<User> {
		const response = await api.patch<ApiResponse<{ user: User }>>(
			"/api/auth/me",
			data
		);
		return response.data.data!.user;
	}

	static async changeMyPassword(
		data: ChangeMyPasswordPayload
	): Promise<{ message: string }> {
		const response = await api.patch<ApiResponse<{ message: string }>>(
			"/api/auth/me/password",
			data
		);
		return response.data.data || { message: "Password updated" };
	}
}
