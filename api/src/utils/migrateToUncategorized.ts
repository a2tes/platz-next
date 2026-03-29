/**
 * Migration script to move all root-level files to Uncategorized folder
 * Run this script once to migrate existing data
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateToUncategorized() {
	try {
		console.log("Starting migration to Uncategorized folder...");

		// Find or create Uncategorized folder
		let uncategorizedFolder = await prisma.mediaFolder.findFirst({
			where: {
				name: "Uncategorized",
				parentId: null,
			},
		});

		if (!uncategorizedFolder) {
			console.log("Creating Uncategorized folder...");
			uncategorizedFolder = await prisma.mediaFolder.create({
				data: {
					name: "Uncategorized",
					parentId: null,
					path: "Uncategorized",
				},
			});
			console.log(
				`Created Uncategorized folder with ID: ${uncategorizedFolder.id}`
			);
		} else {
			console.log(
				`Found existing Uncategorized folder with ID: ${uncategorizedFolder.id}`
			);
		}

		// Find all files with null folderId
		const rootFiles = await prisma.mediaFile.findMany({
			where: {
				folderId: null,
			},
		});

		console.log(`Found ${rootFiles.length} files at root level`);

		if (rootFiles.length === 0) {
			console.log("No files to migrate. Migration complete!");
			return;
		}

		// Update all root files to use Uncategorized folder
		const updatePromises = rootFiles.map((file) => {
			// Storage path is derived from UUID; we only need to set the logical folderId
			return prisma.mediaFile.update({
				where: { id: file.id },
				data: {
					folderId: uncategorizedFolder!.id,
				},
			});
		});

		await Promise.all(updatePromises);

		console.log(
			`Successfully migrated ${rootFiles.length} files to Uncategorized folder`
		);
		console.log("Migration complete!");
	} catch (error) {
		console.error("Migration failed:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Run migration
if (require.main === module) {
	migrateToUncategorized()
		.then(() => {
			console.log("Migration finished successfully");
			process.exit(0);
		})
		.catch((error) => {
			console.error("Migration failed with error:", error);
			process.exit(1);
		});
}

export default migrateToUncategorized;
