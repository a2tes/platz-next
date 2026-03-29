import { prisma } from "../config/database";

const selectionIncludes = {
	director: {
		select: { id: true, title: true, slug: true, status: true },
	},
	work: {
		select: {
			id: true,
			title: true,
			slug: true,
			status: true,
			videoFileId: true,
			videoFile: true,
		},
	},
	clipJob: {
		select: {
			id: true,
			status: true,
			outputPath: true,
			outputUrl: true,
			thumbnailPath: true,
			outputMetadata: true,
			cropSettings: true,
			trimSettings: true,
		},
	},
} as const;

export class HomepageService {
	async getSelections() {
		return prisma.homepageDirector.findMany({
			orderBy: { sortOrder: "asc" },
			include: selectionIncludes,
		});
	}

	async addSelection(directorId: number, workId: number) {
		// Ensure director is published
		const director = await prisma.director.findFirst({
			where: { id: directorId, status: "PUBLISHED" as any, deletedAt: null, purgedAt: null },
			select: { id: true },
		});
		if (!director) {
			throw new Error("Director must be published to be added to the homepage");
		}

		// Ensure work is published
		const work = await prisma.work.findFirst({
			where: { id: workId, status: "PUBLISHED" as any, deletedAt: null, purgedAt: null },
			select: { id: true },
		});
		if (!work) {
			throw new Error("Work must be published to be added to the homepage");
		}

		// Ensure work belongs to the director
		const link = await prisma.workDirector.findFirst({
			where: { directorId, workId },
			select: { workId: true },
		});
		if (!link) {
			throw new Error("Selected work is not associated with this director");
		}

		// Check for duplicate
		const existing = await prisma.homepageDirector.findFirst({
			where: { directorId, workId },
		});
		if (existing) {
			throw new Error("This director+work combination is already on the homepage");
		}

		// Place at end
		const last = await prisma.homepageDirector.findFirst({
			orderBy: { sortOrder: "desc" },
			select: { sortOrder: true },
		});
		const sortOrder = (last?.sortOrder || 0) + 1;

		return prisma.homepageDirector.create({
			data: { directorId, workId, sortOrder },
			include: selectionIncludes,
		});
	}

	async removeSelection(selectionId: number) {
		const row = await prisma.homepageDirector.findUnique({ where: { id: selectionId } });
		if (!row) {
			throw new Error("Homepage selection not found");
		}
		await prisma.homepageDirector.delete({ where: { id: selectionId } });
		return { removed: true, id: selectionId };
	}

	async updateVideoSource(selectionId: number, videoSource: string, clipJobId?: string) {
		const row = await prisma.homepageDirector.findUnique({ where: { id: selectionId } });
		if (!row) {
			throw new Error("Homepage selection not found");
		}

		if (videoSource === "clip" && clipJobId) {
			const clipJob = await prisma.clipJob.findUnique({
				where: { id: clipJobId },
				select: { status: true },
			});
			if (!clipJob) {
				throw new Error("Clip job not found");
			}
		}

		return prisma.homepageDirector.update({
			where: { id: selectionId },
			data: {
				videoSource,
				clipJobId: videoSource === "clip" ? clipJobId : null,
			},
			include: selectionIncludes,
		});
	}

	async getSelection(selectionId: number) {
		const row = await prisma.homepageDirector.findUnique({
			where: { id: selectionId },
			include: selectionIncludes,
		});
		if (!row) {
			throw new Error("Homepage selection not found");
		}
		return row;
	}

	async reorderItems(itemIds: number[]) {
		const updates = itemIds.map((id, index) =>
			prisma.homepageDirector.update({
				where: { id },
				data: { sortOrder: index + 1 },
			}),
		);

		if (updates.length > 0) {
			await prisma.$transaction(updates);
		}
		return { count: updates.length };
	}
}

export const homepageService = new HomepageService();
