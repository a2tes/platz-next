/// <reference types="node" />
import { PrismaClient, BlockPageType, Status } from "@prisma/client";
import path from "path";
import { config as loadEnv } from "dotenv";

// Ensure DATABASE_URL is available when running via ts-node
loadEnv({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
	console.log("🌱 Seeding BlockPages...");

	try {
		// Create Block Pages for block editor system
		const ensureBlockPage = async (type: BlockPageType, title: string, status: Status = Status.PUBLISHED) => {
			return await prisma.blockPage.upsert({
				where: { type },
				update: { title, status },
				create: { type, title, status },
			});
		};

		const worksPage = await ensureBlockPage(BlockPageType.WORKS, "Works Page", Status.PUBLISHED);
		console.log(`✅ Created block page: ${worksPage.type} (${worksPage.title})`);

		console.log("\n🎉 BlockPages seeding completed successfully!");
		console.log("📋 Seeded data summary:");
		console.log(`- Block page (WORKS): "${worksPage.title}" - Status: ${worksPage.status}`);
	} catch (error) {
		console.error("❌ Error during seeding:", error);
		throw error;
	}
}

main()
	.catch((e) => {
		console.error("❌ Seeding failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
