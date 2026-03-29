import { Request, Response } from "express";
import { authenticateUser, refreshAccessToken, logoutUser, logoutUserFromAllDevices } from "../services/authService";
import {
	loginSchema,
	refreshTokenSchema,
	updateUserSchema,
	changePasswordSchema,
	LoginInput,
	RefreshTokenInput,
} from "../utils/validation";
import { updateUser, changeUserPassword } from "../services/userService";
import { mediablesService } from "../services/mediablesService";
import { buildCroppedUrl } from "../utils/serialization";

/**
 * Login endpoint
 */
export const login = async (req: Request, res: Response): Promise<void> => {
	try {
		// Validate request body
		const validatedData: LoginInput = loginSchema.parse(req.body);

		// Authenticate user
		const result = await authenticateUser(validatedData);

		// Get user avatar from mediables
		let avatarUrl: string | null = null;
		try {
			const avatarMediable = await mediablesService.getBySubject({
				subjectType: "User",
				subjectId: result.user.id,
				usageKey: "avatar",
			});
			if (avatarMediable && avatarMediable.media) {
				avatarUrl = buildCroppedUrl(avatarMediable.media, avatarMediable, {
					w: 80,
					h: 80,
					q: 80,
				});
			}
		} catch (err) {
			console.warn("Failed to get user avatar:", err);
		}

		// Set refresh token as HTTP-only cookie
		const refreshTokenExpiry = new Date();
		refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

		res.cookie("refreshToken", result.tokens.refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			expires: refreshTokenExpiry,
			path: "/api/auth",
			domain: process.env.NEXT_PUBLIC_HOSTNAME ? `.${process.env.NEXT_PUBLIC_HOSTNAME}` : undefined,
		});

		// Set access token as HTTP-only cookie for SSE and other cross-origin requests
		// This is more secure than query params or localStorage
		const accessTokenExpiry = new Date();
		accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 4); // 4 hours

		res.cookie("accessToken", result.tokens.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax", // lax allows cross-origin GET requests like SSE
			expires: accessTokenExpiry,
			path: "/",
			domain: process.env.NEXT_PUBLIC_HOSTNAME ? `.${process.env.NEXT_PUBLIC_HOSTNAME}` : undefined,
		});

		// Return success response
		res.json({
			success: true,
			data: {
				user: {
					...result.user,
					avatarUrl,
				},
				accessToken: result.tokens.accessToken,
				expiresIn: 15 * 60, // 15 minutes in seconds
			},
		});
	} catch (error) {
		console.error("Login error:", error);

		if (error instanceof Error) {
			if (error.message === "Invalid credentials") {
				res.status(401).json({
					success: false,
					error: {
						code: "INVALID_CREDENTIALS",
						message: "Invalid email or password",
						timestamp: new Date().toISOString(),
					},
				});
				return;
			}
			if (error.message === "ACCOUNT_INACTIVE") {
				res.status(403).json({
					success: false,
					error: {
						code: "ACCOUNT_INACTIVE",
						message: "Your account is inactive. Please contact an administrator.",
						timestamp: new Date().toISOString(),
					},
				});
				return;
			}
		}

		// Generic error - never expose internal details like database errors
		res.status(500).json({
			success: false,
			error: {
				code: "LOGIN_ERROR",
				message: "Unable to process login request. Please try again later.",
				timestamp: new Date().toISOString(),
			},
		});
	}
};

/**
 * Refresh token endpoint
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
	try {
		// Get refresh token from cookie or body
		const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

		if (!refreshToken) {
			res.status(401).json({
				success: false,
				error: {
					code: "MISSING_REFRESH_TOKEN",
					message: "Refresh token is required",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		// Validate refresh token format
		const validatedData: RefreshTokenInput = refreshTokenSchema.parse({
			refreshToken,
		});

		// Refresh access token
		const result = await refreshAccessToken(validatedData.refreshToken);

		// Set new access token as HTTP-only cookie
		const accessTokenExpiry = new Date();
		accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 4); // 4 hours

		res.cookie("accessToken", result.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			expires: accessTokenExpiry,
			path: "/",
			domain: process.env.NEXT_PUBLIC_HOSTNAME ? `.${process.env.NEXT_PUBLIC_HOSTNAME}` : undefined,
		});

		// Get user avatar from mediables
		let avatarUrl: string | null = null;
		try {
			const avatarMediable = await mediablesService.getBySubject({
				subjectType: "User",
				subjectId: result.user.id,
				usageKey: "avatar",
			});
			if (avatarMediable && avatarMediable.media) {
				avatarUrl = buildCroppedUrl(avatarMediable.media, avatarMediable, {
					w: 80,
					h: 80,
					q: 80,
				});
			}
		} catch (err) {
			console.warn("Failed to get user avatar:", err);
		}

		// Return new access token
		res.json({
			success: true,
			data: {
				user: {
					...result.user,
					avatarUrl,
				},
				accessToken: result.accessToken,
				expiresIn: 15 * 60, // 15 minutes in seconds
			},
		});
	} catch (error) {
		console.error("Refresh token error:", error);

		// Clear invalid refresh token cookie
		res.clearCookie("refreshToken", { path: "/api/auth" });

		if (error instanceof Error && error.message === "ACCOUNT_INACTIVE") {
			res.status(403).json({
				success: false,
				error: {
					code: "ACCOUNT_INACTIVE",
					message: "Your account is inactive. Please contact an administrator.",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		res.status(401).json({
			success: false,
			error: {
				code: "INVALID_REFRESH_TOKEN",
				message: "Invalid or expired refresh token",
				timestamp: new Date().toISOString(),
			},
		});
	}
};

/**
 * Logout endpoint
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
	try {
		// Get refresh token from cookie or body
		const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

		if (refreshToken) {
			// Logout user (invalidate refresh token)
			await logoutUser(refreshToken);
		}

		// Clear all auth cookies
		res.clearCookie("refreshToken", {
			path: "/api/auth",
			domain: process.env.NEXT_PUBLIC_HOSTNAME ? `.${process.env.NEXT_PUBLIC_HOSTNAME}` : undefined,
		});
		res.clearCookie("accessToken", {
			path: "/",
			domain: process.env.NEXT_PUBLIC_HOSTNAME ? `.${process.env.NEXT_PUBLIC_HOSTNAME}` : undefined,
		});

		res.json({
			success: true,
			data: {
				message: "Logged out successfully",
			},
		});
	} catch (error) {
		console.error("Logout error:", error);

		// Clear cookies even if logout fails
		res.clearCookie("refreshToken", {
			path: "/api/auth",
			domain: process.env.NEXT_PUBLIC_HOSTNAME ? `.${process.env.NEXT_PUBLIC_HOSTNAME}` : undefined,
		});
		res.clearCookie("accessToken", {
			path: "/",
			domain: process.env.NEXT_PUBLIC_HOSTNAME ? `.${process.env.NEXT_PUBLIC_HOSTNAME}` : undefined,
		});

		res.json({
			success: true,
			data: {
				message: "Logged out successfully",
			},
		});
	}
};

/**
 * Logout from all devices endpoint
 */
export const logoutAll = async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as any).user?.id;

		if (!userId) {
			res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Authentication required",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		// Logout user from all devices
		await logoutUserFromAllDevices(userId);

		// Clear refresh token cookie
		res.clearCookie("refreshToken", { path: "/api/auth" });

		res.json({
			success: true,
			data: {
				message: "Logged out from all devices successfully",
			},
		});
	} catch (error) {
		console.error("Logout all error:", error);

		res.status(500).json({
			success: false,
			error: {
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to logout from all devices",
				timestamp: new Date().toISOString(),
			},
		});
	}
};

/**
 * Get current user endpoint
 */
export const me = async (req: Request, res: Response): Promise<void> => {
	try {
		const user = (req as any).user;

		if (!user) {
			res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Authentication required",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		// Get user avatar from mediables
		let avatarUrl: string | null = null;
		try {
			const avatarMediable = await mediablesService.getBySubject({
				subjectType: "User",
				subjectId: user.id,
				usageKey: "avatar",
			});
			if (avatarMediable && avatarMediable.media) {
				avatarUrl = buildCroppedUrl(avatarMediable.media, avatarMediable, {
					w: 80,
					h: 80,
					q: 80,
				});
			}
		} catch (err) {
			// Avatar is optional, don't fail if we can't get it
			console.warn("Failed to get user avatar:", err);
		}

		res.json({
			success: true,
			data: {
				user: {
					...user,
					avatarUrl,
				},
			},
		});
	} catch (error) {
		console.error("Get current user error:", error);

		res.status(500).json({
			success: false,
			error: {
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to get user information",
				timestamp: new Date().toISOString(),
			},
		});
	}
};

/**
 * Update current user's profile (name/email)
 */
export const updateMe = async (req: Request, res: Response): Promise<void> => {
	try {
		const user = (req as any).user;

		if (!user) {
			res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Authentication required",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		// Validate input; only allow name/email updates for self
		const parsed = updateUserSchema.parse(req.body);
		const { name, email } = parsed;

		// Handle avatar removal if avatarMediaId is explicitly null
		if (req.body.avatarMediaId === null) {
			try {
				await mediablesService.deleteBySubject({
					subjectType: "User",
					subjectId: user.id,
					usageKey: "avatar",
				});
			} catch (err) {
				console.warn("Failed to delete avatar mediable:", err);
			}
		}

		const updated = await updateUser(user.id, { name, email }, user.id);

		// Get updated avatar URL
		let avatarUrl: string | null = null;
		try {
			const avatarMediable = await mediablesService.getBySubject({
				subjectType: "User",
				subjectId: user.id,
				usageKey: "avatar",
			});
			if (avatarMediable && avatarMediable.media) {
				avatarUrl = buildCroppedUrl(avatarMediable.media, avatarMediable, {
					w: 80,
					h: 80,
					q: 80,
				});
			}
		} catch (err) {
			console.warn("Failed to get user avatar:", err);
		}

		res.json({
			success: true,
			data: {
				user: {
					...updated,
					avatarUrl,
				},
			},
		});
	} catch (error) {
		console.error("Update current user error:", error);
		res.status(400).json({
			success: false,
			error: {
				code: "UPDATE_ERROR",
				message: "Failed to update profile. Please try again.",
				timestamp: new Date().toISOString(),
			},
		});
	}
};

/**
 * Change current user's password
 */
export const changeMyPassword = async (req: Request, res: Response): Promise<void> => {
	try {
		const user = (req as any).user;

		if (!user) {
			res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Authentication required",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		const payload = changePasswordSchema.parse(req.body);
		await changeUserPassword(user.id, payload);

		res.json({
			success: true,
			data: {
				message: "Password updated successfully",
			},
		});
	} catch (error) {
		console.error("Change password error:", error);

		// Only expose "Current password is incorrect" - other errors are generic
		const isWrongPassword = error instanceof Error && error.message === "Current password is incorrect";

		res.status(400).json({
			success: false,
			error: {
				code: "PASSWORD_CHANGE_FAILED",
				message: isWrongPassword ? "Current password is incorrect" : "Failed to change password. Please try again.",
				timestamp: new Date().toISOString(),
			},
		});
	}
};
