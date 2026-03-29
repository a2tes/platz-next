import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation middleware factory
 * Creates middleware to validate request data against Zod schemas
 */
export const validate = (schema: {
	body?: ZodSchema;
	query?: ZodSchema;
	params?: ZodSchema;
}) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		try {
			// Validate request body
			if (schema.body) {
				req.body = schema.body.parse(req.body);
			}

			// Validate query parameters
			if (schema.query) {
				req.query = schema.query.parse(req.query) as any;
			}

			// Validate route parameters
			if (schema.params) {
				req.params = schema.params.parse(req.params) as any;
			}

			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const validationErrors = error.issues.map((err: any) => ({
					field: err.path.join('.'),
					message: err.message,
					code: err.code
				}));

				res.status(400).json({
					success: false,
					error: {
						code: 'VALIDATION_ERROR',
						message: 'Request validation failed',
						details: validationErrors,
						timestamp: new Date().toISOString()
					}
				});
				return;
			}

			// Pass other errors to error handler
			next(error);
		}
	};
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
	// ID parameter validation
	idParam: z.object({
		id: z.string().regex(/^\d+$/, 'ID must be a valid number').transform(Number)
	}),

	// Pagination query validation
	pagination: z.object({
		page: z.string().optional().default('1').transform(Number),
		limit: z.string().optional().default('10').transform(Number),
		sortBy: z.string().optional(),
		sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
	}).refine(data => data.page > 0, {
		message: 'Page must be greater than 0',
		path: ['page']
	}).refine(data => data.limit > 0 && data.limit <= 100, {
		message: 'Limit must be between 1 and 100',
		path: ['limit']
	}),

	// Search query validation
	search: z.object({
		q: z.string().optional(),
		filter: z.string().optional(),
		status: z.enum(['draft', 'published', 'all']).optional().default('all')
	}),

	// File upload validation
	fileUpload: z.object({
		folderId: z.string().optional().transform(val => val ? Number(val) : undefined)
	}),

	// Bulk operations validation
	bulkIds: z.object({
		ids: z.array(z.number()).min(1, 'At least one ID is required')
	}),

	// Status update validation
	statusUpdate: z.object({
		status: z.enum(['draft', 'published'])
	}),

	// Sort order validation
	sortOrder: z.object({
		items: z.array(z.object({
			id: z.number(),
			sortOrder: z.number()
		})).min(1, 'At least one item is required')
	})
};

/**
 * Validation middleware for common use cases
 */
export const validateId = validate({ params: commonSchemas.idParam });
export const validatePagination = validate({ query: commonSchemas.pagination });
export const validateSearch = validate({ query: commonSchemas.search });
export const validateFileUpload = validate({ body: commonSchemas.fileUpload });
export const validateBulkIds = validate({ body: commonSchemas.bulkIds });
export const validateStatusUpdate = validate({ body: commonSchemas.statusUpdate });
export const validateSortOrder = validate({ body: commonSchemas.sortOrder });

/**
 * Custom validation for file uploads with multer
 */
export const validateFileType = (allowedTypes: string[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.file && !req.files) {
			next();
			return;
		}

		const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

		for (const file of files) {
			if (file && !allowedTypes.includes(file.mimetype)) {
				res.status(400).json({
					success: false,
					error: {
						code: 'INVALID_FILE_TYPE',
						message: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
						timestamp: new Date().toISOString()
					}
				});
				return;
			}
		}

		next();
	};
};

/**
 * Validate file size
 */
export const validateFileSize = (maxSizeInMB: number) => {
	const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.file && !req.files) {
			next();
			return;
		}

		const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

		for (const file of files) {
			if (file && file.size > maxSizeInBytes) {
				res.status(400).json({
					success: false,
					error: {
						code: 'FILE_TOO_LARGE',
						message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${maxSizeInMB}MB`,
						timestamp: new Date().toISOString()
					}
				});
				return;
			}
		}

		next();
	};
};