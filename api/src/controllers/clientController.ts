import { Request, Response, NextFunction } from "express";
import { clientService } from "../services/clientService";

/**
 * Get paginated clients
 * GET /api/clients
 */
export async function getClients(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search, sortBy, sortOrder, status, mine } = req.query;
		const userId = (req as any).user?.id;

		const result = await clientService.getClients({
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
 * Search clients for autocomplete
 * GET /api/clients/search
 */
export async function searchClients(req: Request, res: Response, next: NextFunction) {
	try {
		const { q, limit } = req.query;
		const searchLimit = limit ? parseInt(limit as string) : 10;

		// If no query, return all clients (up to limit)
		const clients = await clientService.searchClients((q as string) || "", searchLimit);

		res.json({ data: clients });
	} catch (error) {
		next(error);
	}
}

/**
 * Get a client by ID
 * GET /api/clients/:id
 */
export async function getClientById(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const client = await clientService.getClientById(parseInt(id as string));

		if (!client) {
			return res.status(404).json({ error: "Client not found" });
		}

		res.json({ data: client });
	} catch (error) {
		next(error);
	}
}

/**
 * Create a new client
 * POST /api/clients
 */
export async function createClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { name, status } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const client = await clientService.createClient({ name, status, createdBy: userId });
		res.status(201).json({ data: client });
	} catch (error) {
		next(error);
	}
}

/**
 * Find or create a client by name
 * POST /api/clients/find-or-create
 */
export async function findOrCreateClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { name } = req.body;
		const userId = (req as any).user?.id;

		if (!name) {
			return res.status(400).json({ error: "name is required" });
		}

		const client = await clientService.findOrCreateClient(name, userId);
		res.json({ data: client });
	} catch (error) {
		next(error);
	}
}

/**
 * Update a client
 * PUT /api/clients/:id
 */
export async function updateClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const { name, slug, status } = req.body;

		const client = await clientService.updateClient(parseInt(id as string), { name, slug, status });
		res.json({ data: client });
	} catch (error) {
		next(error);
	}
}

/**
 * Soft delete a client
 * DELETE /api/clients/:id
 */
export async function deleteClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await clientService.deleteClient(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Restore a trashed client
 * POST /api/clients/:id/restore
 */
export async function restoreClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const client = await clientService.restoreClient(parseInt(id as string));
		res.json({ data: client });
	} catch (error) {
		next(error);
	}
}

/**
 * Permanently delete a client
 * POST /api/clients/:id/purge
 */
export async function purgeClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		await clientService.purgeClient(parseInt(id as string));
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Get trashed clients
 * GET /api/clients/trash
 */
export async function getTrashedClients(req: Request, res: Response, next: NextFunction) {
	try {
		const { page, limit, search } = req.query;

		const result = await clientService.getTrashedClients({
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
 * Get client counts
 * GET /api/clients/counts
 */
export async function getClientsCounts(req: Request, res: Response, next: NextFunction) {
	try {
		const counts = await clientService.getCounts();
		res.json(counts);
	} catch (error) {
		next(error);
	}
}

/**
 * Publish a client
 * POST /api/clients/:id/publish
 */
export async function publishClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const client = await clientService.publishClient(parseInt(id as string));
		res.json({ data: client });
	} catch (error) {
		next(error);
	}
}

/**
 * Unpublish a client
 * POST /api/clients/:id/unpublish
 */
export async function unpublishClient(req: Request, res: Response, next: NextFunction) {
	try {
		const { id } = req.params;
		const client = await clientService.unpublishClient(parseInt(id as string));
		res.json({ data: client });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk delete clients
 * POST /api/clients/bulk-delete
 */
export async function bulkDeleteClients(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await clientService.bulkDeleteClients(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}

/**
 * Bulk purge clients
 * POST /api/clients/bulk-purge
 */
export async function bulkPurgeClients(req: Request, res: Response, next: NextFunction) {
	try {
		const { ids } = req.body;
		if (!ids || !Array.isArray(ids)) {
			return res.status(400).json({ error: "ids array is required" });
		}
		await clientService.bulkPurgeClients(ids);
		res.json({ success: true });
	} catch (error) {
		next(error);
	}
}
