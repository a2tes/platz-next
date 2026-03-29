import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
	[key: string]: {
		count: number;
		resetTime: number;
	};
}

// In-memory store for rate limiting
const store: RateLimitStore = {};

export interface RateLimitOptions {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Maximum requests per window
	message?: string; // Custom error message
	skipSuccessfulRequests?: boolean; // Don't count successful requests
	skipFailedRequests?: boolean; // Don't count failed requests
	keyGenerator?: (req: Request) => string; // Custom key generator
}

/**
 * Rate limiting middleware
 */
export const rateLimit = (options: RateLimitOptions) => {
	const {
		windowMs,
		maxRequests,
		message = "Too many requests, please try again later",
		skipSuccessfulRequests = false,
		skipFailedRequests = false,
		keyGenerator = (req: Request) => req.ip || "unknown",
	} = options;

	return (req: Request, res: Response, next: NextFunction): void => {
		const key = keyGenerator(req);
		const now = Date.now();

		// Clean up expired entries
		if (store[key] && store[key].resetTime <= now) {
			delete store[key];
		}

		// Initialize or get current count
		if (!store[key]) {
			store[key] = {
				count: 0,
				resetTime: now + windowMs,
			};
		}

		const current = store[key];

		// Check if limit exceeded
		if (current.count >= maxRequests) {
			const resetTimeSeconds = Math.ceil((current.resetTime - now) / 1000);

			res.status(429).json({
				success: false,
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message,
					retryAfter: resetTimeSeconds,
					timestamp: new Date().toISOString(),
				},
			});
			return;
		}

		// Increment counter
		current.count++;

		// Add rate limit headers
		res.set({
			"X-RateLimit-Limit": maxRequests.toString(),
			"X-RateLimit-Remaining": Math.max(
				0,
				maxRequests - current.count
			).toString(),
			"X-RateLimit-Reset": new Date(current.resetTime).toISOString(),
		});

		// Handle response to potentially skip counting
		if (skipSuccessfulRequests || skipFailedRequests) {
			const originalSend = res.send;
			res.send = function (body) {
				const statusCode = res.statusCode;

				// Decrement counter if we should skip this request
				if (
					(skipSuccessfulRequests && statusCode < 400) ||
					(skipFailedRequests && statusCode >= 400)
				) {
					current.count--;
				}

				return originalSend.call(this, body);
			};
		}

		next();
	};
};

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	maxRequests: process.env.NODE_ENV === "production" ? 10 : 1000, // 10 in prod, 1000 in dev
	message: "Too many authentication attempts, please try again later",
	skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * General API rate limiter
 */
export const apiRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	maxRequests: process.env.NODE_ENV === "production" ? 1000 : 10000, // 1000 in prod, 10000 in dev
	message: "Too many API requests, please try again later",
});

/**
 * Media upload rate limiter
 */
export const uploadRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	maxRequests: 50, // 50 uploads per hour
	message: "Too many upload attempts, please try again later",
});

/**
 * User-specific rate limiter
 */
export const userRateLimit = (
	options: Omit<RateLimitOptions, "keyGenerator">
) => {
	return rateLimit({
		...options,
		keyGenerator: (req: Request) => {
			const user = (req as any).user;
			return user ? `user:${user.id}` : req.ip || "unknown";
		},
	});
};

/**
 * Clean up expired rate limit entries (should be called periodically)
 */
export const cleanupRateLimitStore = (): void => {
	const now = Date.now();

	Object.keys(store).forEach((key) => {
		if (store[key].resetTime <= now) {
			delete store[key];
		}
	});
};

// Clean up expired entries every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
