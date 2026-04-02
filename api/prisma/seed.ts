/// <reference types="node" />
import { PrismaClient, UserRole, Status, PageType, TaxonomyType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import path from "path";
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Ensure DATABASE_URL is available when running via ts-node
loadEnv({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

function slugify(input: string) {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 60);
}

// Helper function to get MIME type from file extension
function getMimeType(filename: string): string {
	const ext = path.extname(filename).toLowerCase();
	const mimeTypes: { [key: string]: string } = {
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
		".mp4": "video/mp4",
		".webm": "video/webm",
		".mov": "video/quicktime",
	};
	return mimeTypes[ext] || "application/octet-stream";
}

// Helper function to get category folder based on MIME type
function getCategoryFolder(mimeType: string): string {
	const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
	const videoTypes = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"];
	const documentTypes = [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	];

	if (imageTypes.includes(mimeType)) return "images";
	if (videoTypes.includes(mimeType)) return "videos";
	if (documentTypes.includes(mimeType)) return "documents";
	return "other";
}

// Helper function to upload media files
async function uploadMediaFiles(imagesFolder: any, videosFolder: any, documentsFolder: any, otherFolder: any) {
	const uploadsDir = path.resolve(__dirname, "../../storage/uploads");
	const sampleFilesDir = path.resolve(__dirname, "../../client/public/sample-files");

	console.log(`📁 Uploads directory: ${uploadsDir}`);
	console.log(`📁 Sample files directory: ${sampleFilesDir}`);

	// Ensure uploads directory exists
	if (!fs.existsSync(uploadsDir)) {
		fs.mkdirSync(uploadsDir, { recursive: true });
		console.log("✅ Created uploads directory");
	}

	const mediaMap: { [key: string]: any } = {};

	// Get list of images and videos from sample-files
	const imagesDir = path.join(sampleFilesDir, "images");
	const videosDir = path.join(sampleFilesDir, "videos");

	console.log(`📁 Images directory: ${imagesDir}`);
	console.log(`📁 Videos directory: ${videosDir}`);

	// Folder mapping
	const folderMap: { [key: string]: any } = {
		images: imagesFolder,
		videos: videosFolder,
		documents: documentsFolder,
		other: otherFolder,
	};

	// Upload images
	if (fs.existsSync(imagesDir)) {
		const imageFiles = fs.readdirSync(imagesDir);
		console.log(`📸 Found ${imageFiles.length} image files`);

		for (const file of imageFiles) {
			const sourcePath = path.join(imagesDir, file);
			const mimeType = getMimeType(file);
			const categoryFolder = getCategoryFolder(mimeType);
			const uuid = `${uuidv4()}/${file}`;
			const destDir = path.join(uploadsDir, categoryFolder, path.dirname(uuid));
			const destPath = path.join(uploadsDir, categoryFolder, uuid);

			try {
				// Create destination directory if it doesn't exist
				if (!fs.existsSync(destDir)) {
					fs.mkdirSync(destDir, { recursive: true });
				}

				// Copy file
				fs.copyFileSync(sourcePath, destPath);
				console.log(`📋 Copied: ${sourcePath} → ${destPath}`);

				// Get file size
				const stats = fs.statSync(destPath);

				// Create media file entry in database
				const mediaFile = await prisma.mediaFile.upsert({
					where: { uuid },
					update: {},
					create: {
						filename: file,
						originalName: file.replace(/\.[^/.]+$/, ""),
						mimeType: mimeType,
						size: BigInt(stats.size),
						uuid,
						folderId: folderMap[categoryFolder].id,
					},
				});

				mediaMap[file] = mediaFile;
				console.log(`✅ Uploaded image: ${file}`);
			} catch (error) {
				console.error(`❌ Error uploading image ${file}:`, error);
			}
		}
	} else {
		console.warn(`⚠️  Images directory not found: ${imagesDir}`);
	}

	// Upload videos
	if (fs.existsSync(videosDir)) {
		const videoFiles = fs.readdirSync(videosDir);
		console.log(`🎬 Found ${videoFiles.length} video files`);

		for (const file of videoFiles) {
			const sourcePath = path.join(videosDir, file);
			const mimeType = getMimeType(file);
			const categoryFolder = getCategoryFolder(mimeType);
			const uuid = `${uuidv4()}/${file}`;
			const destDir = path.join(uploadsDir, categoryFolder, path.dirname(uuid));
			const destPath = path.join(uploadsDir, categoryFolder, uuid);

			try {
				// Create destination directory if it doesn't exist
				if (!fs.existsSync(destDir)) {
					fs.mkdirSync(destDir, { recursive: true });
				}

				// Copy file
				fs.copyFileSync(sourcePath, destPath);
				console.log(`📋 Copied: ${sourcePath} → ${destPath}`);

				// Get file size
				const stats = fs.statSync(destPath);

				// Create media file entry in database
				const mediaFile = await prisma.mediaFile.upsert({
					where: { uuid },
					update: {},
					create: {
						filename: file,
						originalName: file.replace(/\.[^/.]+$/, ""),
						mimeType: mimeType,
						size: BigInt(stats.size),
						uuid,
						folderId: folderMap[categoryFolder].id,
					},
				});

				mediaMap[file] = mediaFile;
				console.log(`✅ Uploaded video: ${file}`);
			} catch (error) {
				console.error(`❌ Error uploading video ${file}:`, error);
			}
		}
	} else {
		console.warn(`⚠️  Videos directory not found: ${videosDir}`);
	}

	return mediaMap;
}
async function main() {
	console.log("🌱 Starting database seeding...");

	// Create admin user
	const adminPassword = await bcrypt.hash("admin123", 10);
	const admin = await prisma.user.upsert({
		where: { email: "admin@example.com" },
		update: {},
		create: {
			email: "admin@example.com",
			passwordHash: adminPassword,
			name: "Admin User",
			role: UserRole.ADMIN,
			status: Status.PUBLISHED,
		},
	});

	// Create editor user
	const editorPassword = await bcrypt.hash("editor123", 10);
	const editor = await prisma.user.upsert({
		where: { email: "editor@example.com" },
		update: {},
		create: {
			email: "editor@example.com",
			passwordHash: editorPassword,
			name: "Editor User",
			role: UserRole.EDITOR,
			status: Status.PUBLISHED,
		},
	});

	console.log("✅ Users created");

	// Create or get media folders
	const ensureFolder = async (name: string, pathValue: string, parentId?: number | null) => {
		const existing = await prisma.mediaFolder.findFirst({
			where: { path: pathValue },
		});
		if (existing) return existing;
		return prisma.mediaFolder.create({
			data: { name, path: pathValue, parentId: parentId ?? null },
		});
	};

	await ensureFolder("Uncategorized", "/Uncategorized");

	// Create media folders
	const rootFolder = await ensureFolder("Root", "/");

	const imagesFolder = await ensureFolder("Images", "/images", rootFolder.id);

	const videosFolder = await ensureFolder("Videos", "/videos", rootFolder.id);

	const documentsFolder = await ensureFolder("Documents", "/documents", rootFolder.id);

	console.log("✅ Media folders created");

	console.log("ℹ️  Starrings removed (model no longer exists)");

	// Create photo categories as taxonomies
	const categories = [
		{ name: "Architecture", slug: "architecture" },
		{ name: "Commercial", slug: "commercial" },
		{ name: "Documentary", slug: "documentary" },
		{ name: "Editorial", slug: "editorial" },
		{ name: "Fashion", slug: "fashion" },
		{ name: "Fine Art", slug: "fine-art" },
		{ name: "Lifestyle", slug: "lifestyle" },
		{ name: "Nature & Wildlife", slug: "nature-wildlife" },
		{ name: "Portrait", slug: "portrait" },
		{ name: "Street", slug: "street" },
	];

	const categoryMap: { [key: string]: any } = {};
	for (const cat of categories) {
		const createdCat = await prisma.taxonomy.upsert({
			where: { type_slug: { type: TaxonomyType.PHOTO_CATEGORY, slug: cat.slug } },
			update: {},
			create: {
				type: TaxonomyType.PHOTO_CATEGORY,
				name: cat.name,
				slug: cat.slug,
				status: Status.PUBLISHED,
				createdBy: admin.id,
			},
		});
		categoryMap[cat.slug] = createdCat;
	}

	console.log("✅ Photo categories created (as taxonomies)");

	// Create directors as taxonomies (replacing old Director model)
	const directors = [
		"André F. Martins",
		"Çağrı Ark",
		"Derhan - Irmak",
		"Drago Sholev",
		"Eddy Schwartz",
		"Emil S. Zakhariev",
		"İlay Alpgiray",
		"Neda Morfova",
		"Oğuz Uydu",
		"Ozan Köse",
		"Sarp Yaman",
		"Silvyo Behmoaras",
		"Vural Uzundağ",
	];

	// Note: Directors no longer have their own model.
	// If you need director taxonomies, create them here.
	// For now, directors are just used as metadata in works.
	console.log("ℹ️  Directors list defined (no Director model — referenced as metadata only)");

	// Create photographers (Turkish alphabetical order)
	const photographers = [
		"Arden Hale",
		"Elara Quinn",
		"Evan Kessler",
		"Jonas Arkwright",
		"Kai Monroe",
		"Lina Moretti",
		"Mira Solberg",
		"Noah Vantrell",
		"Siena Volkova",
		"Taro Whitman",
	];

	const photographerMap: { [key: string]: any } = {};
	for (let i = 0; i < photographers.length; i++) {
		const photographer = await prisma.photographer.upsert({
			where: { slug: slugify(photographers[i]) },
			update: {},
			create: {
				title: photographers[i],
				slug: slugify(photographers[i]),
				bio: `Professional photographer specializing in various photography styles.`,
				status: Status.PUBLISHED,
				publishedAt: new Date(),
				createdBy: admin.id,
			},
		});
		photographerMap[photographers[i]] = photographer;
	}

	console.log("✅ Photographers created");

	// Store references for directors for works assignment
	// Note: directorsList is no longer DB models, just string names
	console.log("ℹ️  Director references are string-only (no Director model)");

	// Upload media files from sample-files
	const otherFolder = await ensureFolder("Other", "/other", rootFolder.id);
	const mediaMap = await uploadMediaFiles(imagesFolder, videosFolder, documentsFolder, otherFolder);
	console.log("✅ Media files uploaded");

	// Create works with specific titles and assigned directors
	const works = [
		{ title: "Pepsi", client: "Pepsi", videoFile: "pepsi.mp4" },
		{ title: "Go Good", client: "Go Good", videoFile: "go-good.mp4" },
		{ title: "Coca Cola", client: "Coca Cola", videoFile: "coca-cola.mp4" },
		{ title: "Döner Club", client: "Döner Club", videoFile: "doner-club.mp4" },
		{
			title: "Sweet Cookies",
			client: "Sweet Cookies",
			videoFile: "sweet-cookie.mp4",
		},
		{ title: "Oreo", client: "Oreo", videoFile: "oreo.mp4" },
		{ title: "Pringles", client: "Pringles", videoFile: "pringles.mp4" },
		{ title: "NBA", client: "NBA", videoFile: "air-jordan.mp4" },
		{ title: "Doritos", client: "Doritos", videoFile: "doritos.mp4" },
		{ title: "Nike", client: "Nike", videoFile: "nike.mp4" },
		{ title: "Dryden", client: "Dryden", videoFile: "dryden.mp4" },
		{
			title: "Coca Cola Vintage",
			client: "Coca Cola",
			videoFile: "coca-cola-vintage.mp4",
		},
	];

	const tags = [
		["commercial", "beverage"],
		["lifestyle", "brand"],
		["commercial", "food"],
		["commercial", "restaurant"],
		["commercial", "snacks"],
		["commercial", "confectionery"],
		["commercial", "snacks"],
		["commercial", "sports"],
		["commercial", "snacks"],
		["commercial", "sports"],
		["commercial", "brand"],
		["commercial", "vintage"],
	];

	// Create client taxonomies for works
	const clientNames = [...new Set(works.map((w) => w.client))];
	const clientTaxonomyMap: { [key: string]: any } = {};
	for (const clientName of clientNames) {
		const clientTax = await prisma.taxonomy.upsert({
			where: { type_slug: { type: TaxonomyType.CLIENT, slug: slugify(clientName) } },
			update: {},
			create: {
				type: TaxonomyType.CLIENT,
				name: clientName,
				slug: slugify(clientName),
				status: Status.PUBLISHED,
				createdBy: admin.id,
			},
		});
		clientTaxonomyMap[clientName] = clientTax;
	}

	// Create works with specific titles
	for (let i = 0; i < works.length; i++) {
		const work = works[i];
		const isPublished = true;
		const creatorId = admin.id;
		const slug = slugify(work.title);
		const videoFileId = work.videoFile && mediaMap[work.videoFile] ? mediaMap[work.videoFile].id : null;
		const clientTaxonomy = clientTaxonomyMap[work.client];

		await prisma.work.upsert({
			where: { slug },
			update: {},
			create: {
				title: work.title,
				slug,
				shortDescription: `${work.client} project directed by ${directors[i % directors.length]}`,
				tags: tags[i],
				status: isPublished ? Status.PUBLISHED : Status.DRAFT,
				publishedAt: isPublished ? new Date() : null,
				createdBy: creatorId,
				sortOrder: 1000 - i,
				videoFileId: videoFileId,
				taxonomies: clientTaxonomy
					? {
							create: [{ taxonomyId: clientTaxonomy.id }],
						}
					: undefined,
			} as any,
		});
	}

	console.log("✅ Works created (12 items)");

	// Create photography entries (idempotent via slug)
	// Get sample images for photography
	const imageFiles = Object.keys(mediaMap).filter((key) => mediaMap[key].mimeType.startsWith("image/"));

	// Get all photographers and categories
	const photographersList = Object.values(photographerMap);
	const categoriesList = Object.values(categoryMap);

	// Photography titles and descriptions
	const photographyTitles = [
		{
			title: "Urban Perspectives",
			description: "A collection of striking urban photography",
			location: "Downtown",
		},
		{
			title: "Nature Awakening",
			description: "Environmental photography exploring themes of renewal",
			location: "Mountains",
		},
		{
			title: "Street Stories",
			description: "Candid moments captured in urban streets",
			location: "City Streets",
		},
		{
			title: "Portrait Sessions",
			description: "Intimate portrait photography series",
			location: "Studio",
		},
		{
			title: "Architectural Forms",
			description: "Modern and contemporary architecture",
			location: "Downtown",
		},
		{
			title: "Lifestyle Moments",
			description: "Authentic lifestyle and everyday moments",
			location: "Various",
		},
		{
			title: "Fashion Editorial",
			description: "High fashion editorial photography",
			location: "Studio",
		},
		{
			title: "Documentary Focus",
			description: "Documentary-style photography series",
			location: "Field",
		},
		{
			title: "Fine Art Series",
			description: "Artistic and fine art photography",
			location: "Landscape",
		},
		{
			title: "Wildlife Collection",
			description: "Wildlife and nature photography",
			location: "Nature",
		},
	];

	// Create 10 photography entries
	for (let i = 0; i < photographyTitles.length; i++) {
		const photoData = photographyTitles[i];
		const imageId = imageFiles.length > 0 ? mediaMap[imageFiles[i % imageFiles.length]].id : null;
		const photographerId = photographersList[i % photographersList.length].id;
		const categoryTaxonomy = categoriesList[i % categoriesList.length];

		if (imageId) {
			const slug = slugify(photoData.title);
			const photo = await prisma.photography.upsert({
				where: { slug },
				update: {},
				create: {
					title: photoData.title,
					slug,
					description: photoData.description,
					imageId,
					photographerId,
					year: 2024,
					location: photoData.location,
					status: Status.PUBLISHED,
					publishedAt: new Date(),
				},
			});

			// Link photography to category taxonomy
			if (categoryTaxonomy) {
				await prisma.photographyTaxonomy.upsert({
					where: {
						photographyId_taxonomyId: {
							photographyId: photo.id,
							taxonomyId: categoryTaxonomy.id,
						},
					},
					update: {},
					create: {
						photographyId: photo.id,
						taxonomyId: categoryTaxonomy.id,
					},
				});
			}
		}
	}

	console.log("✅ Photography entries created (10 items)");

	// Create content pages (ensure one per type)
	const ensureContentPage = async (
		type: PageType,
		title: string,
		metaDescription: string,
		metaKeywords: string,
		status: Status,
	) => {
		const exists = await prisma.contentPage.findFirst({ where: { type } });
		if (exists) return exists;
		const slug = title
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");
		return prisma.contentPage.create({
			data: {
				type,
				slug,
				title,
				metaDescription,
				metaKeywords,
				status,
				publishedAt: status === Status.PUBLISHED ? new Date() : null,
			} as any,
		});
	};

	await ensureContentPage(
		PageType.ABOUT,
		"About Us",
		"Learn about our creative agency and our mission to create exceptional content",
		"about, creative agency, storytelling, brand content",
		Status.PUBLISHED,
	);

	await ensureContentPage(
		PageType.CONTACT,
		"Contact Us",
		"Contact our creative team to discuss your next project",
		"contact, creative services, project inquiry",
		Status.PUBLISHED,
	);

	await ensureContentPage(
		PageType.LEGAL,
		"Privacy Policy",
		"Our privacy policy and data protection practices",
		"privacy policy, data protection, legal",
		Status.PUBLISHED,
	);

	console.log("✅ Content pages created");

	// Create sample API key (skip if already created by name)
	const apiKeyHash = await bcrypt.hash("sample-api-key-123", 10);
	const existingApiKey = await prisma.apiKey.findFirst({
		where: { name: "Development API Key" },
	});
	if (!existingApiKey) {
		await prisma.apiKey.create({
			data: {
				name: "Development API Key",
				keyHash: apiKeyHash,
				permissions: ["read", "write"],
				rateLimit: 1000,
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
			},
		});
	}

	console.log("✅ Sample API key created");

	console.log("🎉 Database seeding completed successfully!");
	console.log("\n📋 Seeded data summary (approx):");
	console.log("- Users: 2 (admin@example.com / admin123, editor@example.com / editor123)");
	console.log("- Media folders: Root, Images, Videos, Documents, Uncategorized");
	console.log("- Taxonomies: Client taxonomies for works, Photo categories");
	console.log("- Works: 12 (with client taxonomy links)");
	console.log("- Photographers: 10");
	console.log("- Photo categories: 10 (as PHOTO_CATEGORY taxonomies)");
	console.log("- Photography entries: 10 (with taxonomy links)");
	console.log("- Content pages: About, Contact, Privacy Policy");
	console.log("- API key: Development API Key");
	console.log("\n💡 Note: Block pages are seeded separately via 'pnpm run db:seed-blockpages'");
}

main()
	.catch((e) => {
		console.error("❌ Error during seeding:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
