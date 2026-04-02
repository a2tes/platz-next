import { Request, Response } from "express";
import * as presentationService from "../services/presentationService";
import { serializeMediaFile, serializeBigInt } from "../utils/serialization";

export const getAllPresentations = async (req: Request, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 25;
		const sortBy = (req.query.sortBy as string) || "createdAt";
		const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
		const search = req.query.search as string;
		const status = req.query.status as "PUBLISHED" | "DRAFT" | "ALL" | "TRASH";
		const mine = req.query.mine === "true";

		const result = await presentationService.getAllPresentations({
			page,
			limit,
			sortBy,
			sortOrder,
			search,
			status,
			mine,
		});
		res.json(result);
	} catch (error) {
		console.error("Error getting presentations:", error);
		res.status(500).json({ error: "Failed to fetch presentations" });
	}
};

export const getPresentationCounts = async (req: Request, res: Response) => {
	try {
		const counts = await presentationService.getPresentationCounts();
		res.json(counts);
	} catch (error) {
		console.error("Error getting presentation counts:", error);
		res.status(500).json({ error: "Failed to fetch presentation counts" });
	}
};

export const getPresentationById = async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) {
			return res.status(400).json({ error: "Invalid ID" });
		}
		const presentation = await presentationService.getPresentationById(id);
		if (!presentation) {
			return res.status(404).json({ error: "Presentation not found" });
		}
		res.json(serializeBigInt(presentation));
	} catch (error) {
		console.error("Error getting presentation:", error);
		res.status(500).json({ error: "Failed to fetch presentation" });
	}
};

export const getPresentationByToken = async (req: Request, res: Response) => {
	try {
		const token = req.params.token as string;
		if (!token) {
			return res.status(400).json({ error: "Token is required" });
		}
		const presentation = await presentationService.getPresentationByToken(token);
		if (!presentation) {
			return res.status(404).json({ error: "Presentation not found or expired" });
		}

		const p = presentation as any;

		// Serialize sections (new format)
		const serializedSections = (p.sections || []).map((section: any) => ({
			title: section.title,
			type: section.type,
			items: section.items.map((item: any) => {
				const result: any = {
					itemType: item.itemType,
					sortOrder: item.sortOrder,
				};

				if (item.itemType === "WORK" && item.work) {
					const w = item.work;
					const videoFile = serializeMediaFile(w.videoFile);
					result.work = {
						id: w.id,
						slug: w.slug,
						title: w.title,
						shortDescription: w.shortDescription,
						subtitle: w.subtitle,
						caseStudy: w.caseStudy,
						videoUrl: videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || videoFile?.video?.default || null,
						hlsUrl: videoFile?.video?.hls || null,
						optimizedVideoUrl: videoFile?.video?.mp4 || null,
						images: videoFile?.images || null,
						clients: w.clients?.map((wc: any) => wc.client?.title).filter(Boolean) || [],
					};
				}

				if (item.itemType === "EXTERNAL_LINK") {
					result.externalUrl = item.externalUrl;
					result.externalTitle = item.externalTitle;
					result.externalDescription = item.externalDescription;
					result.externalThumbnail = item.externalThumbnail ? serializeMediaFile(item.externalThumbnail) : null;
				}

				return result;
			}),
		}));

		// Return new format: full presentation object with sections
		res.json({
			title: p.title,
			clientName: p.clientName,
			clientNote: p.clientNote,
			autoPlayEnabled: p.autoPlayEnabled,
			photoSlideDuration: p.photoSlideDuration,
			sections: serializedSections,
		});
	} catch (error) {
		console.error("Error getting presentation by token:", error);
		res.status(500).json({ error: "Failed to fetch presentation" });
	}
};

export const createPresentation = async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		const presentation = await presentationService.createPresentation({
			...req.body,
			createdBy: userId,
		});
		res.status(201).json(presentation);
	} catch (error) {
		console.error("Error creating presentation:", error);
		res.status(500).json({ error: "Failed to create presentation" });
	}
};

export const updatePresentation = async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) {
			return res.status(400).json({ error: "Invalid ID" });
		}
		const presentation = await presentationService.updatePresentation(id, req.body);
		res.json(presentation);
	} catch (error) {
		console.error("Error updating presentation:", error);
		res.status(500).json({ error: "Failed to update presentation" });
	}
};

export const deletePresentation = async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) {
			return res.status(400).json({ error: "Invalid ID" });
		}
		await presentationService.deletePresentation(id);
		res.status(204).send();
	} catch (error) {
		console.error("Error deleting presentation:", error);
		res.status(500).json({ error: "Failed to delete presentation" });
	}
};

export const restorePresentation = async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) {
			return res.status(400).json({ error: "Invalid ID" });
		}
		await presentationService.restorePresentation(id);
		res.status(204).send();
	} catch (error) {
		console.error("Error restoring presentation:", error);
		res.status(500).json({ error: "Failed to restore presentation" });
	}
};

export const purgePresentation = async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id as string);
		if (isNaN(id)) {
			return res.status(400).json({ error: "Invalid ID" });
		}
		await presentationService.purgePresentation(id);
		res.status(204).send();
	} catch (error) {
		console.error("Error purging presentation:", error);
		res.status(500).json({ error: "Failed to purge presentation" });
	}
};
