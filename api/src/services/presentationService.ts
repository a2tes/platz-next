import { prisma } from "../config/database";
import { v4 as uuidv4 } from "uuid";

const db = prisma as any;

// ============================================
// TYPES
// ============================================

interface GetAllPresentationsOptions {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	search?: string;
	status?: "PUBLISHED" | "DRAFT" | "ALL" | "TRASH";
	mine?: boolean;
}

interface SectionInput {
	title: string;
	type: "DIRECTORS" | "ANIMATIONS" | "PHOTOGRAPHY" | "MIXED";
	items: ItemInput[];
}

interface ItemInput {
	itemType: "WORK" | "ANIMATION" | "PHOTOGRAPHY" | "EXTERNAL_LINK";
	workId?: number;
	animationId?: number;
	photographyId?: number;
	directorId?: number;
	externalUrl?: string;
	externalTitle?: string;
	externalDescription?: string;
	externalThumbnailId?: number;
}

interface CreatePresentationData {
	title: string;
	description?: string;
	clientName?: string;
	clientNote?: string;
	autoPlayEnabled?: boolean;
	photoSlideDuration?: number;
	validUntil?: Date | string | null;
	isActive?: boolean;
	createdBy?: number;
	sections?: SectionInput[];
	// Legacy support
	directors?: {
		directorId: number;
		works: number[];
	}[];
}

interface UpdatePresentationData {
	title?: string;
	description?: string;
	clientName?: string;
	clientNote?: string;
	autoPlayEnabled?: boolean;
	photoSlideDuration?: number;
	validUntil?: Date | string | null;
	isActive?: boolean;
	sections?: SectionInput[];
	// Legacy support
	directors?: {
		directorId: number;
		works: number[];
	}[];
}

export const getAllPresentations = async (options: GetAllPresentationsOptions = {}) => {
	const { page = 1, limit = 25, sortBy = "createdAt", sortOrder = "desc", search, status } = options;

	const where: any = {
		deletedAt: null,
		purgedAt: null,
	};

	if (search) {
		where.title = { contains: search };
	}

	if (status && status !== "ALL") {
		where.isActive = status === "PUBLISHED";
	}

	// Handle trash view
	if (options.status === ("TRASH" as any)) {
		delete where.isActive;
		where.deletedAt = { not: null };
		where.purgedAt = null;
	}

	const [total, data] = await Promise.all([
		db.presentation.count({ where }),
		db.presentation.findMany({
			where,
			orderBy: { [sortBy]: sortOrder },
			skip: (page - 1) * limit,
			take: limit,
			include: {
				_count: {
					select: { directors: true, sections: true },
				},
				creator: {
					select: { id: true, name: true, email: true },
				},
			},
		}),
	]);

	return {
		data,
		meta: {
			pagination: {
				page,
				limit,
				totalPages: Math.ceil(total / limit),
				totalItems: total,
			},
		},
	};
};

export const getPresentationCounts = async () => {
	const [all, published, draft, trash] = await Promise.all([
		db.presentation.count({ where: { deletedAt: null, purgedAt: null } }),
		db.presentation.count({
			where: { isActive: true, deletedAt: null, purgedAt: null },
		}),
		db.presentation.count({
			where: { isActive: false, deletedAt: null, purgedAt: null },
		}),
		db.presentation.count({
			where: { deletedAt: { not: null }, purgedAt: null },
		}),
	]);

	return {
		all,
		mine: all, // No ownership yet
		published,
		draft,
		trash,
	};
};

export const getPresentationById = async (id: number) => {
	return db.presentation.findUnique({
		where: { id },
		include: {
			sections: {
				include: {
					items: {
						include: {
							work: {
								include: {
									previewImage: true,
									directors: {
										include: { director: { include: { avatar: true } } },
									},
								},
							},
							animation: {
								include: {
									previewImage: true,
								},
							},
							photography: {
								include: {
									image: true,
									photographer: true,
								},
							},
							director: {
								include: { avatar: true },
							},
						},
						orderBy: { sortOrder: "asc" },
					},
				},
				orderBy: { sortOrder: "asc" },
			},
			// Keep old relation for backward compat
			directors: {
				include: {
					director: {
						include: {
							avatar: true,
						},
					},
					works: {
						include: {
							work: {
								include: {
									previewImage: true,
								},
							},
						},
						orderBy: { sortOrder: "asc" },
					},
				},
				orderBy: { sortOrder: "asc" },
			},
		},
	});
};

export const getPresentationByToken = async (token: string) => {
	const presentation = await db.presentation.findUnique({
		where: { token },
		include: {
			sections: {
				include: {
					items: {
						include: {
							work: {
								include: {
									previewImage: true,
									videoFile: true,
									directors: {
										include: { director: true },
									},
									clients: {
										include: { client: true },
									},
								},
							},
							animation: {
								include: {
									previewImage: true,
									videoFile: true,
									clients: {
										include: { client: true },
									},
								},
							},
							photography: {
								include: {
									image: true,
									photographer: true,
									clients: {
										include: { client: true },
									},
									categories: {
										include: { category: true },
									},
								},
							},
							director: {
								include: {
									avatar: true,
								},
							},
							externalThumbnail: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
				orderBy: { sortOrder: "asc" },
			},
			// Keep old relation for backward compat
			directors: {
				include: {
					director: {
						include: {
							avatar: true,
						},
					},
					works: {
						include: {
							work: {
								include: {
									previewImage: true,
									videoFile: true,
								},
							},
						},
						orderBy: { sortOrder: "asc" },
					},
				},
				orderBy: { sortOrder: "asc" },
			},
		},
	});

	if (!presentation) return null;

	// Check if active
	if (!presentation.isActive) return null;

	// Check if expired
	if (presentation.validUntil && new Date() > presentation.validUntil) return null;

	return presentation;
};

export const createPresentation = async (data: CreatePresentationData) => {
	const token = uuidv4().replace(/-/g, "").substring(0, 12);
	const isActive = data.isActive ?? true;

	const createData: any = {
		title: data.title,
		description: data.description,
		clientName: data.clientName,
		clientNote: data.clientNote,
		autoPlayEnabled: data.autoPlayEnabled ?? true,
		photoSlideDuration: data.photoSlideDuration ?? 5,
		validUntil: data.validUntil ? new Date(data.validUntil) : null,
		isActive,
		publishedAt: isActive ? new Date() : null,
		token,
		createdBy: data.createdBy,
	};

	// New section-based creation
	if (data.sections && data.sections.length > 0) {
		createData.sections = {
			create: data.sections.map((section, sIndex) => ({
				title: section.title,
				type: section.type,
				sortOrder: sIndex,
				items: {
					create: section.items.map((item, iIndex) => ({
						itemType: item.itemType,
						workId: item.workId || null,
						animationId: item.animationId || null,
						photographyId: item.photographyId || null,
						directorId: item.directorId || null,
						sortOrder: iIndex,
					})),
				},
			})),
		};
	}

	// Legacy director-based creation
	if (data.directors && data.directors.length > 0) {
		createData.directors = {
			create: data.directors.map((d, index) => ({
				directorId: d.directorId,
				sortOrder: index,
				works: {
					create: d.works.map((workId, wIndex) => ({
						workId,
						sortOrder: wIndex,
					})),
				},
			})),
		};
	}

	return db.presentation.create({ data: createData });
};

export const updatePresentation = async (id: number, data: UpdatePresentationData) => {
	const updateData: any = {};
	if (data.title !== undefined) updateData.title = data.title;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.clientName !== undefined) updateData.clientName = data.clientName;
	if (data.clientNote !== undefined) updateData.clientNote = data.clientNote;
	if (data.autoPlayEnabled !== undefined) updateData.autoPlayEnabled = data.autoPlayEnabled;
	if (data.photoSlideDuration !== undefined) updateData.photoSlideDuration = data.photoSlideDuration;
	if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
	if (data.isActive !== undefined) {
		updateData.isActive = data.isActive;
		if (data.isActive) {
			updateData.publishedAt = new Date();
		} else {
			updateData.publishedAt = null;
		}
	}

	const hasSections = data.sections !== undefined;
	const hasDirectors = data.directors !== undefined;

	if (hasSections || hasDirectors) {
		return prisma.$transaction(async (tx: any) => {
			await tx.presentation.update({
				where: { id },
				data: updateData,
			});

			// Handle new sections
			if (hasSections) {
				await tx.presentationSection.deleteMany({
					where: { presentationId: id },
				});

				for (const [sIndex, section] of data.sections!.entries()) {
					await tx.presentationSection.create({
						data: {
							presentationId: id,
							title: section.title,
							type: section.type,
							sortOrder: sIndex,
							items: {
								create: section.items.map((item, iIndex) => ({
									itemType: item.itemType,
									workId: item.workId || null,
									animationId: item.animationId || null,
									photographyId: item.photographyId || null,
									directorId: item.directorId || null,
									externalUrl: item.externalUrl || null,
									externalTitle: item.externalTitle || null,
									externalDescription: item.externalDescription || null,
									externalThumbnailId: item.externalThumbnailId || null,
									sortOrder: iIndex,
								})),
							},
						},
					});
				}
			}

			// Handle legacy directors
			if (hasDirectors) {
				await tx.presentationDirector.deleteMany({
					where: { presentationId: id },
				});

				for (const [index, d] of data.directors!.entries()) {
					await tx.presentationDirector.create({
						data: {
							presentationId: id,
							directorId: d.directorId,
							sortOrder: index,
							works: {
								create: d.works.map((workId, wIndex) => ({
									workId,
									sortOrder: wIndex,
								})),
							},
						},
					});
				}
			}

			return tx.presentation.findUnique({
				where: { id },
				include: {
					sections: {
						include: { items: true },
						orderBy: { sortOrder: "asc" },
					},
					directors: {
						include: { works: true },
						orderBy: { sortOrder: "asc" },
					},
				},
			});
		});
	} else {
		return db.presentation.update({
			where: { id },
			data: updateData,
		});
	}
};

export const deletePresentation = async (id: number) => {
	return db.presentation.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
};

export const restorePresentation = async (id: number) => {
	return db.presentation.update({
		where: { id },
		data: { deletedAt: null },
	});
};

export const purgePresentation = async (id: number) => {
	return db.presentation.update({
		where: { id },
		data: { purgedAt: new Date() },
	});
};

// ============================================
// PHOTOGRAPHY OPTIONS FOR PRESENTATION
// ============================================

export const getPhotographyOptions = async (options: {
	photographerId?: number;
	categoryId?: number;
	clientId?: number;
	search?: string;
}) => {
	const where: any = {
		status: "PUBLISHED",
		deletedAt: null,
	};

	if (options.photographerId) {
		where.photographerId = options.photographerId;
	}

	if (options.categoryId) {
		where.categories = {
			some: { categoryId: options.categoryId },
		};
	}

	if (options.clientId) {
		where.clients = {
			some: { clientId: options.clientId },
		};
	}

	if (options.search) {
		where.title = { contains: options.search };
	}

	return db.photography.findMany({
		where,
		include: {
			image: true,
			photographer: { select: { id: true, title: true } },
			clients: { include: { client: { select: { id: true, name: true } } } },
			categories: { include: { category: { select: { id: true, title: true } } } },
		},
		orderBy: { sortOrder: "asc" },
		take: 200,
	});
};

// ============================================
// ANIMATION OPTIONS FOR PRESENTATION
// ============================================

export const getAnimationOptions = async (options: { search?: string }) => {
	const where: any = {
		status: "PUBLISHED",
		deletedAt: null,
	};

	if (options.search) {
		where.title = { contains: options.search };
	}

	return db.animation.findMany({
		where,
		include: {
			previewImage: true,
			videoFile: true,
		},
		orderBy: { sortOrder: "asc" },
		take: 200,
	});
};
