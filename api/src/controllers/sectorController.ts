import { Request, Response, NextFunction } from "express";
import { sectorService } from "../services/sectorService";

/**
 * Get paginated sectors
 * GET /api/sectors
 */
export async function getSectors(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search, sortBy, sortOrder, status, mine } = req.query;
		const userId = (req as any).user?.id;

		const result = await sectorService.getSectors({
			page: page ? parseInt(page as string) : undefined,
			limit: limit ? parseInt(limit as string) : undefined,
			search: search as string,
			sortBy: sortBy as "name" | "createdAt" | "updatedAt",
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
 * Search sectors for autocomplete
 * GET /api/sectors/search
 */
export async function searchSectors(req: Request, res: Response, next: NextFunction) {
	try {
		const { q, limit } = req.query;
		const searchLimit = limit ? parseInt(limit as string) : 10;

		const sectors = await sectorService.searchSectors((q as string) || "", searchLimit);

		res.json({ data: sectors });
	} catch (error) {
		next(error);
	}
}

/**
 * Get a sector by ID
 * GET /api/sectors/:id
 */
export async function getSectorById(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const sector = await sectorService.getSectorById(parseInt(id as string));

		if (!sector) {
			return res.status(404).json({ error: "Sector not found" });
		}

		res.json({ data: sector });
	} catch (error) {
		next(error);
	}
}

/**
 * Create a new sector
 * POST /api/sectors
 */
export async function createSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { name, status } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const sector = await sectorService.createSector({ name, status, createdBy: userId });
		res.status(201).json({ data: sector });
	} catch (error) {
		next(error);
	}
}

/**
 * Find or create a sector by name
 * POST /api/sectors/find-or-create
 */
export async function findOrCreateSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { name } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const sector = await sectorService.findOrCreateSector(name, userId);
		res.json({ data: sector });
	} catch (error) {
		next(error);
	}
}

/**
 * Update a sector
 * PUT /api/sectors/:id
 */
export async function updateSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const { name, slug, status } = req.body;

		const sector = await sectorService.updateSector(parseInt(id as string), { name, slug, status });
		res.json({ data: sector });
	} catch (error) {
		next(error);
	}
}

/**
 * Soft delete a sector
 * DELETE /api/sectors/:id
 */
export async function deleteSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await sectorService.deleteSector(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Restore a trashed sector
 * POST /api/sectors/:id/restore
 */
export async function restoreSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const sector = await sectorService.restoreSector(parseInt(id as string));
		res.json({ data: sector });
	} catch (error) {
		next(error);
	}
}

/**
 * Permanently delete a sector
 * POST /api/sectors/:id/purge
 */
export async function purgeSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await sectorService.purgeSector(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Get trashed sectors
 * GET /api/sectors/trash
 */
export async function getTrashedSectors(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search } = req.query;

		const result = await sectorService.getTrashedSectors({
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
 * Get sector counts
 * GET /api/sectors/counts
 */
export async function getSectorsCounts(req: Request, res: Response, next: NextFunction) {
	try {
		const counts = await sectorService.getCounts();
		res.json(counts);
	} catch (error) {
		next(error);
	}
}

/**
 * Publish a sector
 * POST /api/sectors/:id/publish
 */
export async function publishSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const sector = await sectorService.publishSector(parseInt(id as string));
		res.json({ data: sector });
	} catch (error) {
		next(error);
	}
}

/**
 * Unpublish a sector
 * POST /api/sectors/:id/unpublish
 */
export async function unpublishSector(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const sector = await sectorService.unpublishSector(parseInt(id as string));
		res.json({ data: sector });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk delete sectors
 * POST /api/sectors/bulk-delete
 */
export async function bulkDeleteSectors(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await sectorService.bulkDeleteSectors(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk purge sectors
 * POST /api/sectors/bulk-purge
 */
export async function bulkPurgeSectors(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await sectorService.bulkPurgeSectors(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}
