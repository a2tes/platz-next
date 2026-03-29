import path from "path";
import fs from "fs";
import sharp from "sharp";
import { prisma } from "../config/database";
import { storageService } from "./storageService";
import { imageService } from "./image";

export interface UpsertMediableInput {
	mediaId: number;
	subjectType: string;
	subjectId: number;
	usageKey: string;
	x: number; // px
	y: number; // px
	w: number; // px
	h: number; // px
	originalW?: number; // optional; will be probed if missing or mismatching
	originalH?: number;
}

export class MediablesService {
	private ensureWithinBoundsPx(x: number, y: number, w: number, h: number, imgW: number, imgH: number) {
		// Clamp to pixel bounds and ensure positive size
		const safeX = Math.max(0, Math.min(imgW, Math.floor(x)));
		const safeY = Math.max(0, Math.min(imgH, Math.floor(y)));
		const maxW = Math.max(0, imgW - safeX);
		const maxH = Math.max(0, imgH - safeY);
		let safeW = Math.max(1, Math.min(maxW, Math.floor(w)));
		let safeH = Math.max(1, Math.min(maxH, Math.floor(h)));
		return { x: safeX, y: safeY, w: safeW, h: safeH };
	}

	async upsert(input: UpsertMediableInput): Promise<any> {
		// Validate media exists and is image
		const media = await prisma.mediaFile.findUnique({
			where: { id: input.mediaId },
		});
		if (!media) throw new Error("Media not found");
		if (!media.mimeType.startsWith("image/")) {
			throw new Error("Crop is only supported for images");
		}

		// Probe original dimensions if not provided
		let originalW = input.originalW ?? 0;
		let originalH = input.originalH ?? 0;
		if (!originalW || !originalH) {
			const buffer = await storageService.getFileBuffer(media.uuid);
			if (!buffer) throw new Error("Unable to read file from storage");

			const meta = await sharp(buffer).metadata();
			originalW = meta.width || 0;
			originalH = meta.height || 0;
		}
		if (!originalW || !originalH) throw new Error("Unable to read original dimensions");

		// Clamp crop (pixels) to image bounds - trust the frontend's coordinates
		const finalRect = this.ensureWithinBoundsPx(input.x, input.y, input.w, input.h, originalW, originalH);

		const p: any = prisma as any;
		// With unique(subjectType, subjectId, usageKey) we upsert by that key and allow mediaId to change.
		return p.mediable.upsert({
			where: {
				subjectType_subjectId_usageKey: {
					subjectType: input.subjectType,
					subjectId: input.subjectId,
					usageKey: input.usageKey,
				},
			},
			update: {
				mediaId: input.mediaId,
				cropX: finalRect.x,
				cropY: finalRect.y,
				cropW: finalRect.w,
				cropH: finalRect.h,
				originalW,
				originalH,
			},
			create: {
				mediaId: input.mediaId,
				subjectType: input.subjectType,
				subjectId: input.subjectId,
				usageKey: input.usageKey,
				cropX: finalRect.x,
				cropY: finalRect.y,
				cropW: finalRect.w,
				cropH: finalRect.h,
				originalW,
				originalH,
			},
		});
	}

	async getOne(params: {
		mediaId: number;
		subjectType: string;
		subjectId: number;
		usageKey: string;
	}): Promise<any | null> {
		const p: any = prisma as any;
		return p.mediable.findFirst({
			where: {
				mediaId: params.mediaId,
				subjectType: params.subjectType,
				subjectId: params.subjectId,
				usageKey: params.usageKey,
			},
			include: {
				media: true,
			},
		});
	}

	async getBySubject(params: { subjectType: string; subjectId: number; usageKey: string }): Promise<any | null> {
		const p: any = prisma as any;
		return p.mediable.findFirst({
			where: {
				subjectType: params.subjectType,
				subjectId: params.subjectId,
				usageKey: params.usageKey,
			},
			include: {
				media: true,
			},
		});
	}

	async deleteOne(params: {
		mediaId: number;
		subjectType: string;
		subjectId: number;
		usageKey: string;
	}): Promise<{ count: number }> {
		const p: any = prisma as any;
		const res = await p.mediable.deleteMany({
			where: {
				mediaId: params.mediaId,
				subjectType: params.subjectType,
				subjectId: params.subjectId,
				usageKey: params.usageKey,
			},
		});
		return { count: res.count ?? 0 };
	}

	async deleteBySubject(params: {
		subjectType: string;
		subjectId: number;
		usageKey: string;
	}): Promise<{ count: number }> {
		const p: any = prisma as any;
		const res = await p.mediable.deleteMany({
			where: {
				subjectType: params.subjectType,
				subjectId: params.subjectId,
				usageKey: params.usageKey,
			},
		});
		return { count: res.count ?? 0 };
	}

	async streamCroppedImage(
		res: import("express").Response,
		params: {
			mediaId: number;
			subjectType: string;
			subjectId: number;
			usageKey: string;
			outW?: number;
			outH?: number;
			format?: "jpeg" | "png" | "webp" | "avif";
			quality?: number;
			override?: { x?: number; y?: number; w?: number; h?: number };
		}
	) {
		const media = await prisma.mediaFile.findUnique({
			where: { id: params.mediaId },
		});
		if (!media) {
			res.status(404).end();
			return;
		}
		if (!media.mimeType.startsWith("image/")) {
			res.status(400).end();
			return;
		}

		const crop = await this.getOne({
			mediaId: params.mediaId,
			subjectType: params.subjectType,
			subjectId: params.subjectId,
			usageKey: params.usageKey,
		});

		// 1. Determine Crop (rect)
		let rect: { x: number; y: number; w: number; h: number } | undefined;

		if (crop) {
			rect = {
				x: Math.max(0, Math.floor(Number(crop.cropX))),
				y: Math.max(0, Math.floor(Number(crop.cropY))),
				w: Math.max(1, Math.floor(Number(crop.cropW))),
				h: Math.max(1, Math.floor(Number(crop.cropH))),
			};
		}

		// Override takes precedence
		if (params.override) {
			const x = params.override.x !== undefined ? params.override.x : rect?.x;
			const y = params.override.y !== undefined ? params.override.y : rect?.y;
			const w = params.override.w !== undefined ? params.override.w : rect?.w;
			const h = params.override.h !== undefined ? params.override.h : rect?.h;

			if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
				rect = { x, y, w, h };
			}
		}

		// Calculate output dimensions
		let outputWidth = params.outW;
		let outputHeight = params.outH;

		if (rect && params.outW && params.outH) {
			// Both specified - calculate proper dimensions from crop aspect
			const cropAspect = rect.w / rect.h;
			const requestedAspect = params.outW / params.outH;

			// If aspects don't match, prioritize width and recalculate height
			if (Math.abs(cropAspect - requestedAspect) > 0.01) {
				outputHeight = Math.round(params.outW / cropAspect);
			}
		}

		// Build URL using image service
		let url: string;

		if (rect) {
			url = imageService.generateCroppedUrl(media.uuid, rect, {
				width: outputWidth,
				height: outputHeight,
				quality: params.quality,
				format: params.format as any,
			});
		} else {
			url = imageService.generateUrl(media.uuid, {
				width: outputWidth,
				height: outputHeight,
				quality: params.quality,
				format: params.format as any,
				fit: params.outW || params.outH ? "crop" : undefined,
			});
		}

		// Redirect to image provider
		res.redirect(url);
	}
}

export const mediablesService = new MediablesService();
