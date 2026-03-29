import { api } from "../lib/api";
import {
	LoginCredentials,
	AuthResponse,
	RefreshResponse,
	User,
} from "../types/auth";

type ApiError = {
	response?: {
		data?: {
			error?: { message?: string };
		};
	};
};

export class AuthService {
	/**
	 * Login user
	 */
	static async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			const response = await api.post<AuthResponse>(
				"/api/auth/login",
				credentials
			);
			return response.data;
		} catch (error: unknown) {
			const err = error as ApiError;
			if (err.response?.data) {
				throw new Error(err.response.data.error?.message || "Login failed");
			}
			throw new Error("Network error occurred");
		}
	}

	/**
	 * Refresh access token
	 */
	static async refreshToken(): Promise<RefreshResponse> {
		try {
			const response = await api.post<RefreshResponse>("/api/auth/refresh");
			return response.data;
		} catch (error: unknown) {
			const err = error as ApiError;
			if (err.response?.data) {
				throw new Error(
					err.response.data.error?.message || "Token refresh failed"
				);
			}
			throw new Error("Network error occurred");
		}
	}

	/**
	 * Logout user
	 */
	static async logout(): Promise<void> {
		try {
			await api.post("/api/auth/logout");
		} catch (error) {
			// Ignore logout errors - we'll clear local state anyway
			console.warn("Logout request failed:", error);
		}
	}

	/**
	 * Logout from all devices
	 */
	static async logoutAll(): Promise<void> {
		try {
			await api.post("/api/auth/logout-all");
		} catch (error: unknown) {
			const err = error as ApiError;
			if (err.response?.data) {
				throw new Error(err.response.data.error?.message || "Logout failed");
			}
			throw new Error("Network error occurred");
		}
	}

	/**
	 * Get current user
	 */
	static async getCurrentUser(): Promise<{ user: User }> {
		try {
			const response = await api.get("/api/auth/me");
			return response.data.data;
		} catch (error: unknown) {
			const err = error as ApiError;
			if (err.response?.data) {
				throw new Error(
					err.response.data.error?.message || "Failed to get user"
				);
			}
			throw new Error("Network error occurred");
		}
	}

	/**
	 * Store access token
	 */
	static setAccessToken(token: string): void {
		if (typeof window !== "undefined") {
			localStorage.setItem("auth_token", token);
		}
	}

	/**
	 * Get stored access token
	 */
	static getAccessToken(): string | null {
		if (typeof window !== "undefined") {
			return localStorage.getItem("auth_token");
		}
		return null;
	}

	/**
	 * Remove access token
	 */
	static removeAccessToken(): void {
		if (typeof window !== "undefined") {
			localStorage.removeItem("auth_token");
		}
	}

	/**
	 * Check if token is expired (basic check)
	 */
	static isTokenExpired(token: string): boolean {
		try {
			const payload = JSON.parse(atob(token.split(".")[1]));
			const currentTime = Date.now() / 1000;
			return payload.exp < currentTime;
		} catch {
			return true;
		}
	}

	/**
	 * Get token expiration time
	 */
	static getTokenExpiration(token: string): Date | null {
		try {
			const payload = JSON.parse(atob(token.split(".")[1]));
			return new Date(payload.exp * 1000);
		} catch {
			return null;
		}
	}
}
