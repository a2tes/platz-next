import { Request, Response, NextFunction } from "express";
import { TaxonomyType } from "@prisma/client";
import { taxonomyService } from "../services/taxonomyService";

// Valid taxonomy types (lowercase for URL params)
const VALID_TYPES: Record<string, TaxonomyType> = {
	clients: "CLIENT",
	sectors: "SECTOR",
	disciplines: "DISCIPLINE",
};

function resolveType(req: Request, res: Response): TaxonomyType | null {
	const typeParam = req.params.type as string;
	const type = VALID_TYPES[typeParam];
	if (!type) {
		res
			.status(400)
			.json({ error: `Invalid taxonomy type: ${typeParam}. Valid types: ${Object.keys(VALID_TYPES).join(", ")}` });
		return null;
	}
	return type;
}

/**
 * Get paginated taxonomies
 * GET /api/taxonomies/:type
 */
export async function getTaxonomies(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { page, limit, search, sortBy, sortOrder, status, mine } = req.query;
		const userId = (req as any).user?.id;

		const result = await taxonomyService.getTaxonomies(type, {
			page: page ? parseInt(page as string) : undefined,
			limit: limit ? parseInt(limit as string) : undefined,
			search: search as string,
			sortBy: sortBy as "name" | "createdAt" | "updatedAt" | "sortOrder",
			sortOrder: sortOrder as "asc" | "desc",
			status: status as "DRAFT" | "PUBLISHED",
			mine: mine === "true",
			userId,
		});

		res.json(result);
	} catch (error) {
		next(error);
	}
}

/**
 * Search taxonomies for autocomplete
 * GET /api/taxonomies/:type/search
 */
export async function searchTaxonomies(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { q, limit } = req.query;
		const searchLimit = limit ? parseInt(limit as string) : 10;

		const taxonomies = await taxonomyService.searchTaxonomies(type, (q as string) || "", searchLimit);
		res.json({ data: taxonomies });
	} catch (error) {
		next(error);
	}
}

/**
 * Get a taxonomy by ID
 * GET /api/taxonomies/:type/:id
 */
export async function getTaxonomyById(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { id } = req.params;
		const taxonomy = await taxonomyService.getTaxonomyById(parseInt(id as string));

		if (!taxonomy || taxonomy.type !== type) {
			return res.status(404).json({ error: "Taxonomy not found" });
		}

		res.json({ data: taxonomy });
	} catch (error) {
		next(error);
	}
}

/**
 * Create a new taxonomy
 * POST /api/taxonomies/:type
 */
export async function createTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { name, status, sortOrder, ogImageId, metaDescription, metaKeywords, metadata } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const taxonomy = await taxonomyService.createTaxonomy({
			type,
			name,
			status,
			sortOrder,
			ogImageId,
			metaDescription,
			metaKeywords,
			metadata,
			createdBy: userId,
		});
		res.status(201).json({ data: taxonomy });
	} catch (error) {
		next(error);
	}
}

/**
 * Find or create a taxonomy by name
 * POST /api/taxonomies/:type/find-or-create
 */
export async function findOrCreateTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { name } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const taxonomy = await taxonomyService.findOrCreate(type, name, userId);
		res.json({ data: taxonomy });
	} catch (error) {
		next(error);
	}
}

/**
 * Update a taxonomy
 * PUT /api/taxonomies/:type/:id
 */
export async function updateTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { id } = req.params;
		const { name, slug, status, sortOrder, ogImageId, metaDescription, metaKeywords, metadata } = req.body;

		const taxonomy = await taxonomyService.updateTaxonomy(parseInt(id as string), {
			name,
			slug,
			status,
			sortOrder,
			ogImageId,
			metaDescription,
			metaKeywords,
			metadata,
		});
		res.json({ data: taxonomy });
	} catch (error) {
		next(error);
	}
}

/**
 * Soft delete a taxonomy
 * DELETE /api/taxonomies/:type/:id
 */
export async function deleteTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { id } = req.params;
		await taxonomyService.deleteTaxonomy(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Restore a trashed taxonomy
 * POST /api/taxonomies/:type/:id/restore
 */
export async function restoreTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { id } = req.params;
		const taxonomy = await taxonomyService.restoreTaxonomy(parseInt(id as string));
		res.json({ data: taxonomy });
	} catch (error) {
		next(error);
	}
}

/**
 * Permanently delete a taxonomy
 * POST /api/taxonomies/:type/:id/purge
 */
export async function purgeTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { id } = req.params;
		await taxonomyService.purgeTaxonomy(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Get trashed taxonomies
 * GET /api/taxonomies/:type/trash
 */
export async function getTrashedTaxonomies(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { page, limit, search } = req.query;

		const result = await taxonomyService.getTrashedTaxonomies(type, {
			page: page ? parseInt(page as string) : undefined,
			limit: limit ? parseInt(limit as string) : undefined,
			search: search as string,
		});

		res.json(result);
	} catch (error) {
		next(error);
	}
}

/**
 * Get taxonomy counts
 * GET /api/taxonomies/:type/counts
 */
export async function getTaxonomyCounts(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const counts = await taxonomyService.getCounts(type);
		res.json(counts);
	} catch (error) {
		next(error);
	}
}

/**
 * Publish a taxonomy
 * POST /api/taxonomies/:type/:id/publish
 */
export async function publishTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { id } = req.params;
		const taxonomy = await taxonomyService.publishTaxonomy(parseInt(id as string));
		res.json({ data: taxonomy });
	} catch (error) {
		next(error);
	}
}

/**
 * Unpublish a taxonomy
 * POST /api/taxonomies/:type/:id/unpublish
 */
export async function unpublishTaxonomy(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { id } = req.params;
		const taxonomy = await taxonomyService.unpublishTaxonomy(parseInt(id as string));
		res.json({ data: taxonomy });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk delete taxonomies
 * POST /api/taxonomies/:type/bulk-delete
 */
export async function bulkDeleteTaxonomies(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await taxonomyService.bulkDelete(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk purge taxonomies
 * POST /api/taxonomies/:type/bulk-purge
 */
export async function bulkPurgeTaxonomies(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await taxonomyService.bulkPurge(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Reorder taxonomies
 * POST /api/taxonomies/:type/reorder
 */
export async function reorderTaxonomies(req: Request, res: Response, next: NextFunction) {
	try {
		const type = resolveType(req, res);
		if (!type) return;

		const { orderedIds } = req.body;
		if (!orderedIds || !Array.isArray(orderedIds)) {
			return res.status(400).json({ error: "orderedIds array is required" });
		}
		await taxonomyService.reorder(type, orderedIds);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}
