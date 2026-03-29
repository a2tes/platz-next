import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { mediablesService } from "../services/mediablesService";

const upsertSchema = z.object({
	mediaId: z.number(),
	subjectType: z.string().min(1),
	subjectId: z.number(),
	usageKey: z.string().min(1).max(64),
	x: z.coerce.number().int().min(0), // px
	y: z.coerce.number().int().min(0), // px
	w: z.coerce.number().int().min(1), // px
	h: z.coerce.number().int().min(1), // px
	originalW: z.number().optional(),
	originalH: z.number().optional(),
});

const getSchema = z.object({
	mediaId: z.coerce.number(),
	subjectType: z.string().min(1),
	subjectId: z.coerce.number(),
	usageKey: z.string().min(1),
});

const resolveBySubjectSchema = z.object({
	subjectType: z.string().min(1),
	subjectId: z.coerce.number(),
	usageKey: z.string().min(1),
});

export class MediablesController {
	private serialize(m: any) {
		if (!m) return null;
		return {
			id: m.id,
			mediaId: m.mediaId,
			media: m.media
				? {
						id: m.media.id,
						uuid: m.media.uuid,
						filename: m.media.filename,
						mimeType: m.media.mimeType,
						altText: m.media.altText,
				  }
				: undefined,
			subjectType: m.subjectType,
			subjectId: m.subjectId,
			usageKey: m.usageKey,
			x: m.cropX,
			y: m.cropY,
			w: m.cropW,
			h: m.cropH,
			originalW: m.originalW,
			originalH: m.originalH,
			createdAt: m.createdAt,
			updatedAt: m.updatedAt,
		};
	}
	async upsert(req: Request, res: Response, next: NextFunction) {
		try {
			const data = upsertSchema.parse(req.body);
			const saved = await mediablesService.upsert(data);
			res.json({ success: true, data: this.serialize(saved) });
		} catch (err) {
			next(err);
		}
	}

	async getOne(req: Request, res: Response, next: NextFunction) {
		try {
			const params = getSchema.parse(req.query);
			const found = await mediablesService.getOne(params);
			if (!found)
				return res.status(404).json({
					success: false,
					error: { code: "NOT_FOUND", message: "Crop not found" },
				});
			res.json({ success: true, data: this.serialize(found) });
		} catch (err) {
			next(err);
		}
	}

	async resolveBySubject(req: Request, res: Response, next: NextFunction) {
		try {
			const params = resolveBySubjectSchema.parse(req.query);
			const found = await mediablesService.getBySubject(params);
			if (!found)
				return res.status(404).json({
					success: false,
					error: { code: "NOT_FOUND", message: "Crop not found" },
				});
			res.json({ success: true, data: this.serialize(found) });
		} catch (err) {
			next(err);
		}
	}

	async deleteOne(req: Request, res: Response, next: NextFunction) {
		try {
			const params = getSchema.parse(req.query);
			const result = await mediablesService.deleteOne(params);
			res.json({ success: true, data: result });
		} catch (err) {
			next(err);
		}
	}

	// Public, no auth. Streams image.
	async cropImagePublic(req: Request, res: Response, next: NextFunction) {
		try {
			const mediaId = Number(req.params.id);
			if (!Number.isFinite(mediaId)) return res.status(400).end();
			const subjectType = String(req.query.subjectType || "");
			const subjectId = Number(req.query.subjectId);
			const usageKey = String(req.query.usageKey || "");
			if (!subjectType || !usageKey || !Number.isFinite(subjectId))
				return res.status(400).end();

			const outW = req.query.w ? Number(req.query.w) : undefined;
			const outH = req.query.h ? Number(req.query.h) : undefined;
			const format = (req.query.format as any) || "jpeg";
			const quality = req.query.q ? Number(req.query.q) : undefined;

			// Optional overrides for crop rectangle via query
			const x = req.query.x ? Number(req.query.x) : undefined;
			const y = req.query.y ? Number(req.query.y) : undefined;
			const cropW =
				req.query.cropW || req.query.cw
					? Number((req.query.cropW || req.query.cw) as string)
					: undefined;
			const cropH =
				req.query.cropH || req.query.ch
					? Number((req.query.cropH || req.query.ch) as string)
					: undefined;

			await mediablesService.streamCroppedImage(res, {
				mediaId,
				subjectType,
				subjectId,
				usageKey,
				outW,
				outH,
				format,
				quality,
				override:
					x !== undefined ||
					y !== undefined ||
					cropW !== undefined ||
					cropH !== undefined
						? { x, y, w: cropW, h: cropH }
						: undefined,
			});
		} catch (err) {
			next(err);
		}
	}
}

export const mediablesController = new MediablesController();
