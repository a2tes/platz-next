import bcrypt from "bcryptjs";
import { PrismaClient, User, UserRole, Status } from "@prisma/client";
import { ApiError } from "../middleware/errorHandler";
import {
	CreateUserInput,
	UpdateUserInput,
	ChangePasswordInput,
} from "../utils/validation";

const prisma = new PrismaClient();

/**
 * Create a new user
 */
export const createUser = async (
	userData: CreateUserInput
): Promise<
	Omit<User, "passwordHash" | "rememberToken" | "deletedAt" | "purgedAt">
> => {
	const { email, password, name, role, status } = userData;

	// Check if user already exists
	const existingUser = await prisma.user.findUnique({
		where: { email: email.toLowerCase(), purgedAt: null } as any,
	});

	if (existingUser) {
		throw new ApiError(
			409,
			"DUPLICATE_ENTRY",
			"A record with this email already exists",
			{ fields: ["email"] }
		);
	}

	// Hash password
	const saltRounds = 12;
	const passwordHash = await bcrypt.hash(password, saltRounds);

	// Create user
	const user = await prisma.user.create({
		data: {
			email: email.toLowerCase(),
			passwordHash,
			name,
			role: role || UserRole.EDITOR,
			status: status || Status.PUBLISHED,
		},
	});

	// Remove sensitive data
	const { passwordHash: _, rememberToken: __, ...safeUser } = user;
	return safeUser;
};

/**
 * Get all users with pagination
 */
export const getUsers = async (
	page: number = 1,
	limit: number = 10,
	search?: string,
	role?: UserRole,
	status?: Status
): Promise<{
	users: Omit<
		User,
		"passwordHash" | "rememberToken" | "deletedAt" | "purgedAt"
	>[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const skip = (page - 1) * limit;

	// Build where clause
	const where: any = {};

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ email: { contains: search, mode: "insensitive" } },
		];
	}

	if (role) {
		where.role = role;
	}
	if (status) {
		(where as any).status = status;
	}

	// Exclude trashed and purged users by default
	(where as any).deletedAt = null;
	(where as any).purgedAt = null;

	// Get users and total count
	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				email: true,
				name: true,
				status: true,
				role: true,
				createdAt: true,
				updatedAt: true,
			},
		}),
		prisma.user.count({ where }),
	]);

	return {
		users,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

/**
 * Get user by ID
 */
export const getUserById = async (
	id: number
): Promise<Omit<
	User,
	"passwordHash" | "rememberToken" | "deletedAt" | "purgedAt"
> | null> => {
	const user = await prisma.user.findFirst({
		where: { id, deletedAt: null, purgedAt: null } as any,
		select: {
			id: true,
			email: true,
			name: true,
			status: true,
			role: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return user;
};

/**
 * Update user
 */
export const updateUser = async (
	id: number,
	userData: UpdateUserInput,
	updatedBy: number
): Promise<
	Omit<User, "passwordHash" | "rememberToken" | "deletedAt" | "purgedAt">
> => {
	const { email, name, role, status } = userData;

	// Check if user exists
	const existingUser = await prisma.user.findUnique({
		where: { id },
	});

	if (!existingUser) {
		throw new Error("User not found");
	}

	// Check if email is already taken by another user
	if (email && email !== existingUser.email) {
		const emailExists = await prisma.user.findFirst({
			where: { email: email.toLowerCase(), purgedAt: null } as any,
		});

		if (emailExists) {
			throw new ApiError(409, "DUPLICATE_ENTRY", "Email is already in use", {
				fields: ["email"],
			});
		}
	}

	// If changing role from ADMIN to non-ADMIN, ensure not the last admin
	if (role && existingUser.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
		const adminCount = await prisma.user.count({
			where: { role: UserRole.ADMIN, deletedAt: null, purgedAt: null } as any,
		});
		if (adminCount <= 1) {
			throw new ApiError(
				400,
				"LAST_ADMIN_CANNOT_BE_DEMOTED",
				"Cannot demote the last remaining admin"
			);
		}
	}

	// If changing status to DRAFT for an ADMIN, ensure not the last active admin
	if (
		typeof status !== "undefined" &&
		status === Status.DRAFT &&
		existingUser.role === UserRole.ADMIN &&
		existingUser.status === Status.PUBLISHED
	) {
		const otherActiveAdmins = await prisma.user.count({
			where: {
				id: { not: id },
				role: UserRole.ADMIN,
				status: Status.PUBLISHED,
				deletedAt: null,
				purgedAt: null,
			} as any,
		});
		if (otherActiveAdmins === 0) {
			throw new ApiError(
				400,
				"LAST_ADMIN_CANNOT_BE_DEACTIVATED",
				"Cannot deactivate the last remaining admin"
			);
		}
	}

	// Update user
	const updatedUser = await prisma.user.update({
		where: { id },
		data: {
			...(email && { email: email.toLowerCase() }),
			...(name && { name }),
			...(role && { role }),
			...(typeof status !== "undefined" && { status }),
		},
		select: {
			id: true,
			email: true,
			name: true,
			status: true,
			role: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return updatedUser;
};

/**
 * Update user status (admin only)
 */
export const updateUserStatus = async (
	id: number,
	status: Status
): Promise<
	Omit<User, "passwordHash" | "rememberToken" | "deletedAt" | "purgedAt">
> => {
	const existingUser = await prisma.user.findUnique({ where: { id } });
	if (!existingUser) {
		throw new Error("User not found");
	}

	// Prevent deactivating the last active admin
	if (
		status === Status.DRAFT &&
		existingUser.role === UserRole.ADMIN &&
		existingUser.status === Status.PUBLISHED
	) {
		const otherActiveAdmins = await prisma.user.count({
			where: {
				id: { not: id },
				role: UserRole.ADMIN,
				status: Status.PUBLISHED,
				deletedAt: null,
				purgedAt: null,
			} as any,
		});

		if (otherActiveAdmins === 0) {
			throw new ApiError(
				400,
				"LAST_ADMIN_CANNOT_BE_DEACTIVATED",
				"Cannot deactivate the last remaining admin"
			);
		}
	}

	const updated = await prisma.user.update({
		where: { id },
		data: { status },
		select: {
			id: true,
			email: true,
			name: true,
			status: true,
			role: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return updated;
};

/**
 * Delete user
 */
export const deleteUser = async (id: number): Promise<void> => {
	// Check if user exists
	const user = await prisma.user.findUnique({
		where: { id },
	});

	if (!user) {
		throw new Error("User not found");
	}

	// Prevent deleting the last admin
	if (user.role === UserRole.ADMIN) {
		const adminCount = await prisma.user.count({
			where: { role: UserRole.ADMIN, deletedAt: null, purgedAt: null } as any,
		});
		if (adminCount <= 1) {
			throw new ApiError(
				400,
				"LAST_ADMIN_CANNOT_BE_DELETED",
				"Cannot delete the last remaining admin"
			);
		}
	}

	// Delete user (this will cascade delete sessions and activities)
	// Soft delete: mark as deletedAt
	await prisma.user.update({
		where: { id },
		data: { deletedAt: new Date() } as any,
	});
};

/**
 * List trashed (soft-deleted) users
 */
export const getTrashedUsers = async (
	page: number = 1,
	limit: number = 20,
	search?: string
): Promise<{
	users: Omit<
		User,
		"passwordHash" | "rememberToken" | "deletedAt" | "purgedAt"
	>[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const skip = (page - 1) * limit;
	const where: any = { deletedAt: { not: null }, purgedAt: null };
	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ email: { contains: search, mode: "insensitive" } },
		];
	}

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { deletedAt: "desc" },
			select: {
				id: true,
				email: true,
				name: true,
				status: true,
				role: true,
				createdAt: true,
				updatedAt: true,
			},
		}),
		prisma.user.count({ where }),
	]);

	return {
		users,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

/**
 * Restore a soft-deleted user
 */
export const restoreUser = async (
	id: number
): Promise<
	Omit<User, "passwordHash" | "rememberToken" | "deletedAt" | "purgedAt">
> => {
	const existing = await prisma.user.findFirst({
		where: { id, deletedAt: { not: null }, purgedAt: null } as any,
	});
	if (!existing) {
		throw new Error("User not found in trash");
	}

	const restored = await prisma.user.update({
		where: { id },
		data: { deletedAt: null } as any,
		select: {
			id: true,
			email: true,
			name: true,
			status: true,
			role: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return restored;
};

/**
 * Change user password
 */
export const changeUserPassword = async (
	userId: number,
	passwordData: ChangePasswordInput
): Promise<void> => {
	const { currentPassword, newPassword } = passwordData;

	// Get user with password hash
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	if (!user) {
		throw new Error("User not found");
	}

	// Verify current password
	const isCurrentPasswordValid = await bcrypt.compare(
		currentPassword,
		user.passwordHash
	);
	if (!isCurrentPasswordValid) {
		throw new Error("Current password is incorrect");
	}

	// Hash new password
	const saltRounds = 12;
	const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

	// Update password and clear remember token
	await prisma.user.update({
		where: { id: userId },
		data: {
			passwordHash: newPasswordHash,
			rememberToken: null,
		},
	});

	// Invalidate all sessions for this user
	await prisma.session.deleteMany({
		where: { userId },
	});
};

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (
	userId: number,
	newRole: UserRole,
	updatedBy: number
): Promise<
	Omit<User, "passwordHash" | "rememberToken" | "deletedAt" | "purgedAt">
> => {
	// Check if user exists
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	if (!user) {
		throw new Error("User not found");
	}

	// Update role
	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: { role: newRole },
		select: {
			id: true,
			email: true,
			name: true,
			status: true,
			role: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return updatedUser;
};

/**
 * Get user statistics
 */
export const getUserStats = async (): Promise<{
	total: number;
	byRole: Record<UserRole, number>;
	recentUsers: number;
}> => {
	const [total, roleStats, recentUsers] = await Promise.all([
		prisma.user.count(),
		prisma.user.groupBy({
			by: ["role"],
			_count: { role: true },
		}),
		prisma.user.count({
			where: {
				createdAt: {
					gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
				},
			},
		}),
	]);

	const byRole = roleStats.reduce((acc, stat) => {
		acc[stat.role] = stat._count.role;
		return acc;
	}, {} as Record<UserRole, number>);

	// Ensure all roles are represented
	Object.values(UserRole).forEach((role) => {
		if (!(role in byRole)) {
			byRole[role] = 0;
		}
	});

	return {
		total,
		byRole,
		recentUsers,
	};
};
