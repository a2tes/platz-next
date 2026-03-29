import bcrypt from "bcryptjs";
import { PrismaClient, User } from "@prisma/client";
import { generateTokenPair, verifyRefreshToken, TokenPair } from "../utils/jwt";
import crypto from "crypto";

const prisma = new PrismaClient();

export interface LoginCredentials {
	email: string;
	password: string;
	rememberMe?: boolean;
}

export interface AuthResult {
	user: Omit<User, "passwordHash" | "rememberToken">;
	tokens: TokenPair;
}

export interface RefreshTokenResult {
	accessToken: string;
	user: Omit<User, "passwordHash" | "rememberToken">;
}

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (
	credentials: LoginCredentials
): Promise<AuthResult> => {
	const { email, password, rememberMe = false } = credentials;

	// Find user by email
	const user = await prisma.user.findFirst({
		where: {
			email: email.toLowerCase(),
			deletedAt: null,
			purgedAt: null,
		} as any,
	});

	if (!user) {
		throw new Error("Invalid credentials");
	}

	// Block login for inactive (DRAFT) users
	if (user.status !== "PUBLISHED") {
		throw new Error("ACCOUNT_INACTIVE");
	}

	// Verify password
	const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
	if (!isPasswordValid) {
		throw new Error("Invalid credentials");
	}

	// Generate tokens
	const tokens = generateTokenPair(user);

	// Handle remember me functionality
	let updatedUser = user;
	if (rememberMe) {
		const rememberToken = crypto.randomBytes(32).toString("hex");
		updatedUser = await prisma.user.update({
			where: { id: user.id },
			data: { rememberToken },
		});
	}

	// Create session record
	const refreshTokenHash = crypto
		.createHash("sha256")
		.update(tokens.refreshToken)
		.digest("hex");
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

	await prisma.session.create({
		data: {
			userId: user.id,
			tokenHash: refreshTokenHash,
			expiresAt,
		},
	});

	// Remove sensitive data from user object
	const { passwordHash, rememberToken, ...safeUser } = updatedUser;

	return {
		user: safeUser,
		tokens,
	};
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (
	refreshToken: string
): Promise<RefreshTokenResult> => {
	try {
		// Verify refresh token
		const payload = verifyRefreshToken(refreshToken);

		// Check if session exists and is valid
		const refreshTokenHash = crypto
			.createHash("sha256")
			.update(refreshToken)
			.digest("hex");
		const session = await prisma.session.findFirst({
			where: {
				tokenHash: refreshTokenHash,
				userId: payload.userId,
				expiresAt: {
					gt: new Date(),
				},
			},
			include: {
				user: true,
			},
		});

		if (!session) {
			throw new Error("Invalid refresh token");
		}

		// Block refresh for inactive (DRAFT) users
		if (session.user.status !== "PUBLISHED") {
			throw new Error("ACCOUNT_INACTIVE");
		}

		// Generate new access token
		const newTokens = generateTokenPair(session.user);

		// Update session with new refresh token hash
		const newRefreshTokenHash = crypto
			.createHash("sha256")
			.update(newTokens.refreshToken)
			.digest("hex");
		await prisma.session.update({
			where: { id: session.id },
			data: { tokenHash: newRefreshTokenHash },
		});

		// Remove sensitive data from user object
		const { passwordHash, rememberToken, ...safeUser } = session.user;

		return {
			accessToken: newTokens.accessToken,
			user: safeUser,
		};
	} catch (error) {
		// Bubble up specific inactive account error
		if (error instanceof Error && error.message === "ACCOUNT_INACTIVE") {
			throw error;
		}
		throw new Error("Invalid refresh token");
	}
};

/**
 * Logout user by invalidating refresh token
 */
export const logoutUser = async (refreshToken: string): Promise<void> => {
	try {
		const refreshTokenHash = crypto
			.createHash("sha256")
			.update(refreshToken)
			.digest("hex");

		// Delete session
		await prisma.session.deleteMany({
			where: {
				tokenHash: refreshTokenHash,
			},
		});
	} catch (error) {
		// Silently fail - token might already be invalid
		console.warn("Logout warning:", error);
	}
};

/**
 * Logout user from all devices
 */
export const logoutUserFromAllDevices = async (
	userId: number
): Promise<void> => {
	await prisma.session.deleteMany({
		where: {
			userId,
		},
	});

	// Clear remember token
	await prisma.user.update({
		where: { id: userId },
		data: { rememberToken: null },
	});
};

/**
 * Get user by ID (for middleware)
 */
export const getUserById = async (
	userId: number
): Promise<Omit<User, "passwordHash" | "rememberToken"> | null> => {
	const user = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null, purgedAt: null } as any,
	});

	if (!user) {
		return null;
	}

	const { passwordHash, rememberToken, ...safeUser } = user;
	return safeUser;
};

/**
 * Validate remember token
 */
export const validateRememberToken = async (
	userId: number,
	rememberToken: string
): Promise<boolean> => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	return user?.rememberToken === rememberToken;
};

/**
 * Clean up expired sessions
 */
export const cleanupExpiredSessions = async (): Promise<void> => {
	await prisma.session.deleteMany({
		where: {
			expiresAt: {
				lt: new Date(),
			},
		},
	});
};
