import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, extractTokenFromHeader } from "../utils/jwt";
import { getUserById } from "../services/authService";
import { UserRole, Status } from "@prisma/client";

// Extend Request interface to include user
declare global {
	namespace Express {
		interface Request {
			user?: {
				id: number;
				email: string;
				name: string;
				role: UserRole;
				status: Status;
				createdAt: Date;
				updatedAt: Date;
			};
		}
	}
}

/**
 * Middleware to authenticate JWT token
 * Supports: Authorization header and httpOnly cookies
 * Cookies are essential for SSE (EventSource) which can't send custom headers
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		// Extract token from Authorization header first (API clients)
		let token = extractTokenFromHeader(req.headers.authorization);

		// Fall back to httpOnly cookie (browser clients, SSE)
		if (!token && req.cookies?.accessToken) {
			token = req.cookies.accessToken;
		}

		if (!token) {
			res.status(401).json({
				success: false,
				error: {
					code: "MISSING_TOKEN",
					message: "Access token is required",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		// Verify token
		const payload = verifyAccessToken(token);

		// Get user from database
		const user = await getUserById(payload.userId);

		if (!user) {
			res.status(401).json({
				success: false,
				error: {
					code: "USER_NOT_FOUND",
					message: "User not found",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		// Block inactive users
		if (user.status !== "PUBLISHED") {
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

		// Attach user to request
		req.user = user;
		next();
	} catch (error) {
		console.error("Authentication error:", error);

		res.status(401).json({
			success: false,
			error: {
				code: "INVALID_TOKEN",
				message: "Invalid or expired access token",
				timestamp: new Date().toISOString(),
			},
		});
	}
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (allowedRoles: UserRole[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
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

		if (!allowedRoles.includes(req.user.role)) {
			res.status(403).json({
				success: false,
				error: {
					code: "INSUFFICIENT_PERMISSIONS",
					message: "Insufficient permissions to access this resource",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		next();
	};
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole([UserRole.ADMIN]);

/**
 * Middleware to check if user is admin or editor
 */
export const requireEditor = requireRole([UserRole.ADMIN, UserRole.EDITOR]);

/**
 * Middleware to check if user can view content (all roles)
 */
export const requireViewer = requireRole([UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER]);

/**
 * Permission checking utilities
 */
export class PermissionChecker {
	/**
	 * Check if user can create content
	 */
	static canCreate(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user can edit content
	 */
	static canEdit(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user can delete content
	 */
	static canDelete(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user can view content
	 */
	static canView(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user can manage users
	 */
	static canManageUsers(userRole: UserRole): boolean {
		return userRole === UserRole.ADMIN;
	}

	/**
	 * Check if user can manage system settings
	 */
	static canManageSettings(userRole: UserRole): boolean {
		return userRole === UserRole.ADMIN;
	}

	/**
	 * Check if user can publish content
	 */
	static canPublish(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user can access media gallery
	 */
	static canAccessMedia(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user can upload media
	 */
	static canUploadMedia(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user can delete media
	 */
	static canDeleteMedia(userRole: UserRole): boolean {
		return ([UserRole.ADMIN, UserRole.EDITOR] as UserRole[]).includes(userRole);
	}

	/**
	 * Check if user owns resource or has admin privileges
	 */
	static canAccessOwnResource(userRole: UserRole, resourceUserId: number, currentUserId: number): boolean {
		return userRole === UserRole.ADMIN || resourceUserId === currentUserId;
	}
}

/**
 * Middleware to check specific permissions
 */
export const requirePermission = (permissionCheck: (userRole: UserRole) => boolean) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
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

		if (!permissionCheck(req.user.role)) {
			res.status(403).json({
				success: false,
				error: {
					code: "INSUFFICIENT_PERMISSIONS",
					message: "Insufficient permissions to perform this action",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		next();
	};
};

/**
 * Middleware to check resource ownership or admin privileges
 */
export const requireOwnershipOrAdmin = (getUserIdFromRequest: (req: Request) => number) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
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

		const resourceUserId = getUserIdFromRequest(req);

		if (!PermissionChecker.canAccessOwnResource(req.user.role, resourceUserId, req.user.id)) {
			res.status(403).json({
				success: false,
				error: {
					code: "INSUFFICIENT_PERMISSIONS",
					message: "You can only access your own resources",
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		next();
	};
};
