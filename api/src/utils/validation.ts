import { z } from "zod";

// Login validation schema
export const loginSchema = z.object({
	email: z
		.string()
		.email("Invalid email format")
		.min(1, "Email is required")
		.max(191, "Email is too long"),
	password: z
		.string()
		.min(1, "Password is required")
		.max(191, "Password is too long"),
	rememberMe: z.boolean().optional().default(false),
});

// Refresh token validation schema
export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required"),
});

// User creation schema (for future use)
export const createUserSchema = z.object({
	email: z
		.string()
		.email("Invalid email format")
		.min(1, "Email is required")
		.max(191, "Email is too long"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(191, "Password is too long")
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
			"Password must contain at least one lowercase letter, one uppercase letter, and one number"
		),
	name: z.string().min(1, "Name is required").max(191, "Name is too long"),
	role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional().default("EDITOR"),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("PUBLISHED"),
});

// Update user schema
export const updateUserSchema = z.object({
	email: z
		.string()
		.email("Invalid email format")
		.min(1, "Email is required")
		.max(191, "Email is too long")
		.optional(),
	name: z
		.string()
		.min(1, "Name is required")
		.max(191, "Name is too long")
		.optional(),
	role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

// Users listing query schema (admin)
export const getUsersQuerySchema = z.object({
	page: z.coerce.number().min(1).default(1),
	limit: z.coerce.number().min(1).max(100).default(20),
	search: z.string().optional(),
	role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

// Update user status schema (admin)
export const updateUserStatusSchema = z.object({
	status: z.enum(["DRAFT", "PUBLISHED"]),
});

// Change password schema
export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.max(191, "Password is too long")
			.regex(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
				"Password must contain at least one lowercase letter, one uppercase letter, and one number"
			),
		confirmPassword: z.string().min(1, "Password confirmation is required"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type GetUsersQueryInput = z.infer<typeof getUsersQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
