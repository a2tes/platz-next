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
						directors:
							w.directors?.map((wd: any) => ({
								title: wd.director.title,
								slug: wd.director.slug,
							})) || [],
						starrings:
							w.starrings?.map((ws: any) => ({
								title: ws.starring.title,
								slug: ws.starring.slug,
							})) || [],
						clients: w.clients?.map((wc: any) => wc.client?.title).filter(Boolean) || [],
					};
					if (item.director) {
						result.director = {
							id: item.director.id,
							title: item.director.title,
							slug: item.director.slug,
							avatar: item.director.avatar ? serializeMediaFile(item.director.avatar) : null,
						};
					}
				}

				if (item.itemType === "ANIMATION" && item.animation) {
					const a = item.animation;
					const videoFile = serializeMediaFile(a.videoFile);
					result.animation = {
						id: a.id,
						slug: a.slug,
						title: a.title,
						shortDescription: a.shortDescription,
						videoUrl: videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || videoFile?.video?.default || null,
						hlsUrl: videoFile?.video?.hls || null,
						optimizedVideoUrl: videoFile?.video?.mp4 || null,
						images: videoFile?.images || null,
						clients: a.clients?.map((ac: any) => ac.client?.title).filter(Boolean) || [],
					};
				}

				if (item.itemType === "PHOTOGRAPHY" && item.photography) {
					const ph = item.photography;
					const image = serializeMediaFile(ph.image);
					result.photography = {
						id: ph.id,
						title: ph.title,
						slug: ph.slug,
						description: ph.description,
						year: ph.year,
						location: ph.location,
						images: image?.images || null,
						photographer: ph.photographer
							? {
									id: ph.photographer.id,
									title: ph.photographer.title,
								}
							: null,
						clients: ph.clients?.map((pc: any) => pc.client?.title).filter(Boolean) || [],
						categories: ph.categories?.map((pcat: any) => pcat.category?.title).filter(Boolean) || [],
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

		// Also serialize legacy directors for backward compat
		const serializedDirectors = (p.directors || []).map((pd: any) => {
			const { director, works } = pd;
			const firstWork = works[0]?.work;
			const firstWorkVideo = firstWork ? serializeMediaFile(firstWork.videoFile) : null;

			return {
				slug: director.slug,
				title: director.title,
				work: firstWork
					? {
							title: firstWork.title,
							slug: firstWork.slug,
						}
					: null,
				videoUrl:
					firstWorkVideo?.video?.mp4_720p || firstWorkVideo?.video?.mp4 || firstWorkVideo?.video?.default || null,
				videoUrl720p: firstWorkVideo?.video?.mp4_720p || firstWorkVideo?.video?.mp4 || null,
				hlsUrl: firstWorkVideo?.video?.hls || null,
				works: works.map((pw: any) => {
					const w = pw.work;
					const videoFile = serializeMediaFile(w.videoFile);

					return {
						work: {
							slug: w.slug,
							title: w.title,
							shortDescription: w.shortDescription,
							subtitle: w.subtitle,
							caseStudy: w.caseStudy,
							videoUrl: videoFile?.video?.mp4_720p || videoFile?.video?.mp4 || videoFile?.video?.default || null,
							hlsUrl: videoFile?.video?.hls || null,
							optimizedVideoUrl: videoFile?.video?.mp4 || null,
							images: videoFile?.images || null,
							starrings:
								w.starrings?.map((s: any) => ({
									title: s.starring.title,
									slug: s.starring.slug,
								})) || [],
						},
					};
				}),
			};
		});

		// Return new format: full presentation object with sections
		res.json({
			title: p.title,
			clientName: p.clientName,
			clientNote: p.clientNote,
			autoPlayEnabled: p.autoPlayEnabled,
			photoSlideDuration: p.photoSlideDuration,
			sections: serializedSections,
			// Legacy data
			directors: serializedDirectors,
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

export const getPhotographyOptions = async (req: Request, res: Response) => {
	try {
		const photographerId = req.query.photographerId ? parseInt(req.query.photographerId as string) : undefined;
		const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
		const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
		const search = req.query.search as string;

		const photos = await presentationService.getPhotographyOptions({
			photographerId,
			categoryId,
			clientId,
			search,
		});
		res.json(serializeBigInt(photos));
	} catch (error) {
		console.error("Error getting photography options:", error);
		res.status(500).json({ error: "Failed to fetch photography options" });
	}
};

export const getAnimationOptions = async (req: Request, res: Response) => {
	try {
		const search = req.query.search as string;

		const animations = await presentationService.getAnimationOptions({ search });
		res.json(serializeBigInt(animations));
	} catch (error) {
		console.error("Error getting animation options:", error);
		res.status(500).json({ error: "Failed to fetch animation options" });
	}
};
