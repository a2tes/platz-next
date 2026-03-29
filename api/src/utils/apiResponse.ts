import { Response } from 'express';

/**
 * Standard API response interfaces
 */
export interface ApiSuccessResponse<T = any> {
	success: true;
	data: T;
	meta?: {
		pagination?: PaginationMeta;
		timestamp?: string;
		[key: string]: any;
	};
}

export interface ApiErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
		details?: any;
		timestamp: string;
	};
}

export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

/**
 * API response utilities
 */
export class ApiResponse {
	/**
	 * Send success response
	 */
	static success<T>(
		res: Response,
		data: T,
		statusCode: number = 200,
		meta?: ApiSuccessResponse<T>['meta']
	): void {
		const response: ApiSuccessResponse<T> = {
			success: true,
			data,
			meta: {
				timestamp: new Date().toISOString(),
				...meta
			}
		};

		res.status(statusCode).json(response);
	}

	/**
	 * Send paginated success response
	 */
	static paginated<T>(
		res: Response,
		data: T[],
		pagination: PaginationMeta,
		statusCode: number = 200
	): void {
		const response: ApiSuccessResponse<T[]> = {
			success: true,
			data,
			meta: {
				pagination,
				timestamp: new Date().toISOString()
			}
		};

		res.status(statusCode).json(response);
	}

	/**
	 * Send created response
	 */
	static created<T>(res: Response, data: T, meta?: any): void {
		this.success(res, data, 201, meta);
	}

	/**
	 * Send no content response
	 */
	static noContent(res: Response): void {
		res.status(204).send();
	}

	/**
	 * Send error response
	 */
	static error(
		res: Response,
		code: string,
		message: string,
		statusCode: number = 500,
		details?: any
	): void {
		const response: ApiErrorResponse = {
			success: false,
			error: {
				code,
				message,
				details,
				timestamp: new Date().toISOString()
			}
		};

		res.status(statusCode).json(response);
	}

	/**
	 * Send bad request error
	 */
	static badRequest(res: Response, message: string, details?: any): void {
		this.error(res, 'BAD_REQUEST', message, 400, details);
	}

	/**
	 * Send unauthorized error
	 */
	static unauthorized(res: Response, message: string = 'Unauthorized'): void {
		this.error(res, 'UNAUTHORIZED', message, 401);
	}

	/**
	 * Send forbidden error
	 */
	static forbidden(res: Response, message: string = 'Forbidden'): void {
		this.error(res, 'FORBIDDEN', message, 403);
	}

	/**
	 * Send not found error
	 */
	static notFound(res: Response, message: string = 'Resource not found'): void {
		this.error(res, 'NOT_FOUND', message, 404);
	}

	/**
	 * Send conflict error
	 */
	static conflict(res: Response, message: string, details?: any): void {
		this.error(res, 'CONFLICT', message, 409, details);
	}

	/**
	 * Send validation error
	 */
	static validationError(res: Response, details: any): void {
		this.error(res, 'VALIDATION_ERROR', 'Validation failed', 422, details);
	}

	/**
	 * Send internal server error
	 */
	static internalError(res: Response, message: string = 'Internal server error'): void {
		this.error(res, 'INTERNAL_SERVER_ERROR', message, 500);
	}
}

/**
 * Calculate pagination metadata
 */
export const calculatePagination = (
	page: number,
	limit: number,
	total: number
): PaginationMeta => {
	const totalPages = Math.ceil(total / limit);

	return {
		page,
		limit,
		total,
		totalPages,
		hasNextPage: page < totalPages,
		hasPrevPage: page > 1
	};
};

/**
 * Parse pagination parameters from query
 */
export const parsePaginationQuery = (query: any): { page: number; limit: number; skip: number } => {
	const page = Math.max(1, parseInt(query.page) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
	const skip = (page - 1) * limit;

	return { page, limit, skip };
};

/**
 * Parse sort parameters from query
 */
export const parseSortQuery = (query: any, allowedFields: string[] = []): { sortBy?: string; sortOrder: 'asc' | 'desc' } => {
	const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : undefined;
	const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

	return { sortBy, sortOrder };
};

/**
 * Parse search parameters from query
 */
export const parseSearchQuery = (query: any): { search?: string; filters: Record<string, any> } => {
	const search = query.q || query.search || undefined;
	const filters: Record<string, any> = {};

	// Extract filter parameters (anything that's not pagination, sort, or search)
	const excludedKeys = ['page', 'limit', 'sortBy', 'sortOrder', 'q', 'search'];

	Object.keys(query).forEach(key => {
		if (!excludedKeys.includes(key) && query[key] !== undefined && query[key] !== '') {
			filters[key] = query[key];
		}
	});

	return { search, filters };
};