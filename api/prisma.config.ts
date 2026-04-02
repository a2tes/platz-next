import { defineConfig } from "prisma/config";
// Ensure Prisma CLI loads environment variables even when prisma.config.ts is present
import path from "path";
import { config as loadEnv } from "dotenv";

// Load backend/.env explicitly (Prisma skips automatic env loading when prisma.config.ts exists)
loadEnv({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
	seed: {
		command: "npx ts-node prisma/seed.ts",
	},
});
