import { Request, Response, NextFunction } from "express";
import { agencyService } from "../services/agencyService";

/**
 * Get paginated agencies
 * GET /api/agencies
 */
export async function getAgencies(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search, sortBy, sortOrder, status, mine } = req.query;
		const userId = (req as any).user?.id;

		const result = await agencyService.getAgencies({
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
 * Search agencies for autocomplete
 * GET /api/agencies/search
 */
export async function searchAgencies(req: Request, res: Response, next: NextFunction) {
	try {
		const { q, limit } = req.query;
		const searchLimit = limit ? parseInt(limit as string) : 10;

		// If no query, return all agencies (up to limit)
		const agencies = await agencyService.searchAgencies((q as string) || "", searchLimit);

		res.json({ data: agencies });
	} catch (error) {
		next(error);
	}
}

/**
 * Get an agency by ID
 * GET /api/agencies/:id
 */
export async function getAgencyById(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const agency = await agencyService.getAgencyById(parseInt(id as string));

		if (!agency) {
			return res.status(404).json({ error: "Agency not found" });
		}

		res.json({ data: agency });
	} catch (error) {
		next(error);
	}
}

/**
 * Create a new agency
 * POST /api/agencies
 */
export async function createAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { name, status } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const agency = await agencyService.createAgency({ name, status, createdBy: userId });
		res.status(201).json({ data: agency });
	} catch (error) {
		next(error);
	}
}

/**
 * Find or create an agency by name
 * POST /api/agencies/find-or-create
 */
export async function findOrCreateAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { name } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const agency = await agencyService.findOrCreateAgency(name, userId);
		res.json({ data: agency });
	} catch (error) {
		next(error);
	}
}

/**
 * Update an agency
 * PUT /api/agencies/:id
 */
export async function updateAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const { name, slug, status } = req.body;

		const agency = await agencyService.updateAgency(parseInt(id as string), { name, slug, status });
		res.json({ data: agency });
	} catch (error) {
		next(error);
	}
}

/**
 * Soft delete an agency
 * DELETE /api/agencies/:id
 */
export async function deleteAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await agencyService.deleteAgency(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Restore a trashed agency
 * POST /api/agencies/:id/restore
 */
export async function restoreAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const agency = await agencyService.restoreAgency(parseInt(id as string));
		res.json({ data: agency });
	} catch (error) {
		next(error);
	}
}

/**
 * Permanently delete an agency
 * POST /api/agencies/:id/purge
 */
export async function purgeAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await agencyService.purgeAgency(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Get trashed agencies
 * GET /api/agencies/trash
 */
export async function getTrashedAgencies(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search } = req.query;

		const result = await agencyService.getTrashedAgencies({
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
 * Get agency counts
 * GET /api/agencies/counts
 */
export async function getAgenciesCounts(req: Request, res: Response, next: NextFunction) {
	try {
		const counts = await agencyService.getCounts();
		res.json(counts);
	} catch (error) {
		next(error);
	}
}

/**
 * Publish an agency
 * POST /api/agencies/:id/publish
 */
export async function publishAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const agency = await agencyService.publishAgency(parseInt(id as string));
		res.json({ data: agency });
	} catch (error) {
		next(error);
	}
}

/**
 * Unpublish an agency
 * POST /api/agencies/:id/unpublish
 */
export async function unpublishAgency(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const agency = await agencyService.unpublishAgency(parseInt(id as string));
		res.json({ data: agency });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk delete agencies
 * POST /api/agencies/bulk-delete
 */
export async function bulkDeleteAgencies(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await agencyService.bulkDeleteAgencies(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk purge agencies
 * POST /api/agencies/bulk-purge
 */
export async function bulkPurgeAgencies(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await agencyService.bulkPurgeAgencies(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}
