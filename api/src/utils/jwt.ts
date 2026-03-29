import jwt from "jsonwebtoken";
import { User } from "@prisma/client";

export interface JWTPayload {
	userId: number;
	email: string;
	role: string;
	type: "access" | "refresh";
}

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
}

const ACCESS_TOKEN_SECRET =
	process.env.JWT_ACCESS_SECRET || "your-access-secret-key";
const REFRESH_TOKEN_SECRET =
	process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "4h";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Generate access token for user
 */
export const generateAccessToken = (
	user: Pick<User, "id" | "email" | "role">
): string => {
	const payload: JWTPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
		type: "access",
	};

	return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN,
		issuer: "cms-admin-panel",
		audience: "cms-users",
	} as jwt.SignOptions);
};

/**
 * Generate refresh token for user
 */
export const generateRefreshToken = (
	user: Pick<User, "id" | "email" | "role">
): string => {
	const payload: JWTPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
		type: "refresh",
	};

	return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
		expiresIn: REFRESH_TOKEN_EXPIRES_IN,
		issuer: "cms-admin-panel",
		audience: "cms-users",
	} as jwt.SignOptions);
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (
	user: Pick<User, "id" | "email" | "role">
): TokenPair => {
	return {
		accessToken: generateAccessToken(user),
		refreshToken: generateRefreshToken(user),
	};
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): JWTPayload => {
	try {
		const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
			issuer: "cms-admin-panel",
			audience: "cms-users",
		}) as JWTPayload;

		if (decoded.type !== "access") {
			throw new Error("Invalid token type");
		}

		return decoded;
	} catch (error) {
		throw new Error("Invalid access token");
	}
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
	try {
		const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
			issuer: "cms-admin-panel",
			audience: "cms-users",
		}) as JWTPayload;

		if (decoded.type !== "refresh") {
			throw new Error("Invalid token type");
		}

		return decoded;
	} catch (error) {
		throw new Error("Invalid refresh token");
	}
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (
	authHeader: string | undefined
): string | null => {
	if (!authHeader) {
		return null;
	}

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") {
		return null;
	}

	return parts[1];
};

/**
 * Get token expiration time in seconds
 */
export const getTokenExpirationTime = (token: string): number => {
	try {
		const decoded = jwt.decode(token) as any;
		return decoded.exp;
	} catch (error) {
		throw new Error("Invalid token");
	}
};
