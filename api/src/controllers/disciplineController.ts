import { Request, Response, NextFunction } from "express";
import { disciplineService } from "../services/disciplineService";

/**
 * Get paginated disciplines
 * GET /api/disciplines
 */
export async function getDisciplines(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search, sortBy, sortOrder, status, mine } = req.query;
		const userId = (req as any).user?.id;

		const result = await disciplineService.getDisciplines({
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
 * Search disciplines for autocomplete
 * GET /api/disciplines/search
 */
export async function searchDisciplines(req: Request, res: Response, next: NextFunction) {
	try {
		const { q, limit } = req.query;
		const searchLimit = limit ? parseInt(limit as string) : 10;

		const disciplines = await disciplineService.searchDisciplines((q as string) || "", searchLimit);

		res.json({ data: disciplines });
	} catch (error) {
		next(error);
	}
}

/**
 * Get a discipline by ID
 * GET /api/disciplines/:id
 */
export async function getDisciplineById(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const discipline = await disciplineService.getDisciplineById(parseInt(id as string));

		if (!discipline) {
			return res.status(404).json({ error: "Discipline not found" });
		}

		res.json({ data: discipline });
	} catch (error) {
		next(error);
	}
}

/**
 * Create a new discipline
 * POST /api/disciplines
 */
export async function createDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { name, status } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const discipline = await disciplineService.createDiscipline({ name, status, createdBy: userId });
		res.status(201).json({ data: discipline });
	} catch (error) {
		next(error);
	}
}

/**
 * Find or create a discipline by name
 * POST /api/disciplines/find-or-create
 */
export async function findOrCreateDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { name } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const discipline = await disciplineService.findOrCreateDiscipline(name, userId);
		res.json({ data: discipline });
	} catch (error) {
		next(error);
	}
}

/**
 * Update a discipline
 * PUT /api/disciplines/:id
 */
export async function updateDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const { name, slug, status } = req.body;

		const discipline = await disciplineService.updateDiscipline(parseInt(id as string), { name, slug, status });
		res.json({ data: discipline });
	} catch (error) {
		next(error);
	}
}

/**
 * Soft delete a discipline
 * DELETE /api/disciplines/:id
 */
export async function deleteDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await disciplineService.deleteDiscipline(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Restore a trashed discipline
 * POST /api/disciplines/:id/restore
 */
export async function restoreDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const discipline = await disciplineService.restoreDiscipline(parseInt(id as string));
		res.json({ data: discipline });
	} catch (error) {
		next(error);
	}
}

/**
 * Permanently delete a discipline
 * POST /api/disciplines/:id/purge
 */
export async function purgeDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await disciplineService.purgeDiscipline(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Get trashed disciplines
 * GET /api/disciplines/trash
 */
export async function getTrashedDisciplines(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search } = req.query;

		const result = await disciplineService.getTrashedDisciplines({
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
 * Get discipline counts
 * GET /api/disciplines/counts
 */
export async function getDisciplinesCounts(req: Request, res: Response, next: NextFunction) {
	try {
		const counts = await disciplineService.getCounts();
		res.json(counts);
	} catch (error) {
		next(error);
	}
}

/**
 * Publish a discipline
 * POST /api/disciplines/:id/publish
 */
export async function publishDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const discipline = await disciplineService.publishDiscipline(parseInt(id as string));
		res.json({ data: discipline });
	} catch (error) {
		next(error);
	}
}

/**
 * Unpublish a discipline
 * POST /api/disciplines/:id/unpublish
 */
export async function unpublishDiscipline(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const discipline = await disciplineService.unpublishDiscipline(parseInt(id as string));
		res.json({ data: discipline });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk delete disciplines
 * POST /api/disciplines/bulk-delete
 */
export async function bulkDeleteDisciplines(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await disciplineService.bulkDeleteDisciplines(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk purge disciplines
 * POST /api/disciplines/bulk-purge
 */
export async function bulkPurgeDisciplines(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await disciplineService.bulkPurgeDisciplines(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}
