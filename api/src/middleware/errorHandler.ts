import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import {
	PrismaClientKnownRequestError,
	PrismaClientValidationError,
} from "@prisma/client/runtime/library";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
	public statusCode: number;
	public code: string;
	public details?: any;

	constructor(
		statusCode: number,
		code: string,
		message: string,
		details?: any
	) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
		this.name = "ApiError";
	}
}

/**
 * Error response interface
 */
interface ErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
		details?: any;
		timestamp: string;
	};
}

/**
 * Create standardized error response
 */
const createErrorResponse = (
	code: string,
	message: string,
	details?: any
): ErrorResponse => ({
	success: false,
	error: {
		code,
		message,
		details,
		timestamp: new Date().toISOString(),
	},
});

/**
 * Handle Prisma database errors
 */
const handlePrismaError = (
	error: PrismaClientKnownRequestError
): { statusCode: number; response: ErrorResponse } => {
	switch (error.code) {
		case "P2002":
			// Unique constraint violation
			const target = error.meta?.target;
			const targetFields = Array.isArray(target)
				? target
				: typeof target === "string"
				? [target]
				: [];
			return {
				statusCode: 409,
				response: createErrorResponse(
					"DUPLICATE_ENTRY",
					`A record with this ${targetFields.join(", ")} already exists`,
					{ fields: targetFields }
				),
			};

		case "P2025":
			// Record not found
			return {
				statusCode: 404,
				response: createErrorResponse(
					"RECORD_NOT_FOUND",
					"The requested record was not found"
				),
			};

		case "P2003":
			// Foreign key constraint violation
			return {
				statusCode: 400,
				response: createErrorResponse(
					"FOREIGN_KEY_CONSTRAINT",
					"Cannot perform this operation due to related records",
					{ field: error.meta?.field_name }
				),
			};

		case "P2014":
			// Required relation violation
			return {
				statusCode: 400,
				response: createErrorResponse(
					"REQUIRED_RELATION_VIOLATION",
					"A required relation is missing",
					{ relation: error.meta?.relation_name }
				),
			};

		case "P2021":
			// Table does not exist
			return {
				statusCode: 500,
				response: createErrorResponse(
					"DATABASE_ERROR",
					"Database table does not exist"
				),
			};

		case "P2022":
			// Column does not exist
			return {
				statusCode: 500,
				response: createErrorResponse(
					"DATABASE_ERROR",
					"Database column does not exist"
				),
			};

		default:
			return {
				statusCode: 500,
				response: createErrorResponse(
					"DATABASE_ERROR",
					"A database error occurred",
					process.env.NODE_ENV === "development"
						? { prismaCode: error.code, meta: error.meta }
						: undefined
				),
			};
	}
};

/**
 * Handle Zod validation errors
 */
const handleZodError = (
	error: ZodError
): { statusCode: number; response: ErrorResponse } => {
	const validationErrors = error.issues.map((err: any) => ({
		field: err.path.join("."),
		message: err.message,
		code: err.code,
	}));

	return {
		statusCode: 400,
		response: createErrorResponse(
			"VALIDATION_ERROR",
			"Request validation failed",
			validationErrors
		),
	};
};

/**
 * Handle JWT errors
 */
const handleJWTError = (
	error: Error
): { statusCode: number; response: ErrorResponse } => {
	if (error.name === "TokenExpiredError") {
		return {
			statusCode: 401,
			response: createErrorResponse(
				"TOKEN_EXPIRED",
				"Authentication token has expired"
			),
		};
	}

	if (error.name === "JsonWebTokenError") {
		return {
			statusCode: 401,
			response: createErrorResponse(
				"INVALID_TOKEN",
				"Invalid authentication token"
			),
		};
	}

	return {
		statusCode: 401,
		response: createErrorResponse(
			"AUTHENTICATION_ERROR",
			"Authentication failed"
		),
	};
};

/**
 * Handle multer file upload errors
 */
const handleMulterError = (
	error: any
): { statusCode: number; response: ErrorResponse } => {
	switch (error.code) {
		case "LIMIT_FILE_SIZE":
			return {
				statusCode: 400,
				response: createErrorResponse(
					"FILE_TOO_LARGE",
					"File size exceeds the maximum allowed limit"
				),
			};

		case "LIMIT_FILE_COUNT":
			return {
				statusCode: 400,
				response: createErrorResponse(
					"TOO_MANY_FILES",
					"Too many files uploaded"
				),
			};

		case "LIMIT_UNEXPECTED_FILE":
			return {
				statusCode: 400,
				response: createErrorResponse(
					"UNEXPECTED_FILE",
					"Unexpected file field"
				),
			};

		default:
			return {
				statusCode: 400,
				response: createErrorResponse(
					"FILE_UPLOAD_ERROR",
					"File upload failed",
					process.env.NODE_ENV === "development"
						? { multerCode: error.code }
						: undefined
				),
			};
	}
};

/**
 * Main error handling middleware
 */
export const errorHandler = (
	error: Error,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	// Log error for debugging
	console.error("Error occurred:", {
		message: error.message,
		stack: error.stack,
		url: req.url,
		method: req.method,
		timestamp: new Date().toISOString(),
	});

	// Handle different types of errors
	let statusCode = 500;
	let response: ErrorResponse;

	if (error instanceof ApiError) {
		// Custom API errors
		statusCode = error.statusCode;
		response = createErrorResponse(error.code, error.message, error.details);
	} else if (error instanceof PrismaClientKnownRequestError) {
		// Prisma database errors
		const handled = handlePrismaError(error);
		statusCode = handled.statusCode;
		response = handled.response;
	} else if (error instanceof PrismaClientValidationError) {
		// Prisma validation errors
		statusCode = 400;
		response = createErrorResponse(
			"DATABASE_VALIDATION_ERROR",
			"Database validation failed",
			process.env.NODE_ENV === "development"
				? { message: error.message }
				: undefined
		);
	} else if (error instanceof ZodError) {
		// Zod validation errors
		const handled = handleZodError(error);
		statusCode = handled.statusCode;
		response = handled.response;
	} else if (
		error.name === "TokenExpiredError" ||
		error.name === "JsonWebTokenError"
	) {
		// JWT errors
		const handled = handleJWTError(error);
		statusCode = handled.statusCode;
		response = handled.response;
	} else if (error.name === "MulterError") {
		// Multer file upload errors
		const handled = handleMulterError(error);
		statusCode = handled.statusCode;
		response = handled.response;
	} else if (error.name === "SyntaxError" && "body" in error) {
		// JSON parsing errors
		statusCode = 400;
		response = createErrorResponse(
			"INVALID_JSON",
			"Invalid JSON in request body"
		);
	} else {
		// Generic server errors
		response = createErrorResponse(
			"INTERNAL_SERVER_ERROR",
			process.env.NODE_ENV === "production"
				? "Something went wrong!"
				: error.message,
			process.env.NODE_ENV === "development"
				? { stack: error.stack }
				: undefined
		);
	}

	res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
	res
		.status(404)
		.json(
			createErrorResponse(
				"NOT_FOUND",
				`Route ${req.method} ${req.originalUrl} not found`
			)
		);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};

/**
 * Create API error instances
 */
export const createApiError = {
	badRequest: (message: string, details?: any) =>
		new ApiError(400, "BAD_REQUEST", message, details),
	unauthorized: (message: string = "Unauthorized") =>
		new ApiError(401, "UNAUTHORIZED", message),
	forbidden: (message: string = "Forbidden") =>
		new ApiError(403, "FORBIDDEN", message),
	notFound: (message: string = "Not found") =>
		new ApiError(404, "NOT_FOUND", message),
	conflict: (message: string, details?: any) =>
		new ApiError(409, "CONFLICT", message, details),
	unprocessableEntity: (message: string, details?: any) =>
		new ApiError(422, "UNPROCESSABLE_ENTITY", message, details),
	tooManyRequests: (message: string = "Too many requests") =>
		new ApiError(429, "TOO_MANY_REQUESTS", message),
	internalServer: (message: string = "Internal server error") =>
		new ApiError(500, "INTERNAL_SERVER_ERROR", message),
};
