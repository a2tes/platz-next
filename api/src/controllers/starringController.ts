import { Request, Response, NextFunction } from "express";
import { starringService } from "../services/starringService";

export const starringController = {
	// GET /starrings
	async getAll(req: Request, res: Response, next: NextFunction) {
		try {
			const search = req.query.search as string | undefined;
			const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

			const starrings = await starringService.getAll(search, limit);

			// Map to expected format (name instead of title)
			const mapped = starrings.map((s) => ({
				id: s.id,
				name: s.title,
				slug: s.slug,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
			}));

			res.json({
				success: true,
				data: mapped,
			});
		} catch (error) {
			next(error);
		}
	},

	// GET /starrings/search
	async search(req: Request, res: Response, next: NextFunction) {
		try {
			const query = (req.query.q as string) || "";
			const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

			const starrings = await starringService.search(query, limit);

			const mapped = starrings.map((s) => ({
				id: s.id,
				name: s.title,
				slug: s.slug,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
			}));

			res.json({
				success: true,
				data: mapped,
			});
		} catch (error) {
			next(error);
		}
	},

	// GET /starrings/:id
	async getById(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const starring = await starringService.getById(id);

			if (!starring) {
				return res.status(404).json({
					success: false,
					error: "Starring not found",
				});
			}

			res.json({
				success: true,
				data: {
					id: starring.id,
					name: starring.title,
					slug: starring.slug,
					createdAt: starring.createdAt,
					updatedAt: starring.updatedAt,
				},
			});
		} catch (error) {
			next(error);
		}
	},

	// POST /starrings
	async create(req: Request, res: Response, next: NextFunction) {
		try {
			const { name } = req.body;

			if (!name || typeof name !== "string") {
				return res.status(400).json({
					success: false,
					error: "Name is required",
				});
			}

			const starring = await starringService.create({ name });

			res.status(201).json({
				success: true,
				data: {
					id: starring.id,
					name: starring.title,
					slug: starring.slug,
					createdAt: starring.createdAt,
					updatedAt: starring.updatedAt,
				},
			});
		} catch (error) {
			next(error);
		}
	},

	// POST /starrings/find-or-create
	async findOrCreate(req: Request, res: Response, next: NextFunction) {
		try {
			const { name } = req.body;

			if (!name || typeof name !== "string") {
				return res.status(400).json({
					success: false,
					error: "Name is required",
				});
			}

			const starring = await starringService.findOrCreate(name);

			res.json({
				success: true,
				data: {
					id: starring.id,
					name: starring.title,
					slug: starring.slug,
					createdAt: starring.createdAt,
					updatedAt: starring.updatedAt,
				},
			});
		} catch (error) {
			next(error);
		}
	},

	// PUT /starrings/:id
	async update(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			const { name } = req.body;

			const starring = await starringService.update(id, { name });

			res.json({
				success: true,
				data: {
					id: starring.id,
					name: starring.title,
					slug: starring.slug,
					createdAt: starring.createdAt,
					updatedAt: starring.updatedAt,
				},
			});
		} catch (error) {
			next(error);
		}
	},

	// DELETE /starrings/:id
	async delete(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseInt(req.params.id as string);
			await starringService.delete(id);

			res.json({
				success: true,
				message: "Starring deleted",
			});
		} catch (error) {
			next(error);
		}
	},
};
