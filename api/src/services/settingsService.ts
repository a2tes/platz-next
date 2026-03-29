import { prisma } from "../config/database";

export class SettingsService {
	/**
	 * Get all site settings as a key-value map
	 */
	static async getAll(): Promise<Record<string, any>> {
		const rows = await prisma.siteSetting.findMany();
		const settings: Record<string, any> = {};
		for (const row of rows) {
			settings[row.key] = row.value;
		}
		return settings;
	}

	/**
	 * Get a single setting by key
	 */
	static async get(key: string): Promise<any> {
		const row = await prisma.siteSetting.findUnique({ where: { key } });
		return row?.value ?? null;
	}

	/**
	 * Upsert multiple settings at once
	 */
	static async updateMany(settings: Record<string, any>): Promise<Record<string, any>> {
		const entries = Object.entries(settings);
		await prisma.$transaction(
			entries.map(([key, value]) =>
				prisma.siteSetting.upsert({
					where: { key },
					create: { key, value },
					update: { value },
				}),
			),
		);
		return this.getAll();
	}
}
