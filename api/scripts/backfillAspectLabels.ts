/**
 * Backfill aspectLabel in cropSettings for existing ClipJob records.
 * Reads the aspect value from cropSettings and maps it to the correct preset label.
 *
 * Usage: npx ts-node scripts/backfillAspectLabels.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ASPECT_PRESETS = [
	{ label: "Ultra Widescreen (21:9)", value: 21 / 9 },
	{ label: "Standard Widescreen (16:9)", value: 16 / 9 },
	{ label: "Poster (5:4)", value: 5 / 4 },
	{ label: "Classic (4:3)", value: 4 / 3 },
	{ label: "Photo (3:2)", value: 3 / 2 },
	{ label: "Modern Cinematic (2:1)", value: 2 / 1 },
	{ label: "Square (1:1)", value: 1 },
	{ label: "Portrait Photo (2:3)", value: 2 / 3 },
	{ label: "Classic Portrait (3:4)", value: 3 / 4 },
	{ label: "Social Portrait (4:5)", value: 4 / 5 },
	{ label: "Story / Reel (9:16)", value: 9 / 16 },
	{ label: "Vertical Poster (1:2)", value: 1 / 2 },
];

function getAspectLabel(aspect: number): string {
	if (!aspect || aspect === 0) return "Freeform";
	for (const preset of ASPECT_PRESETS) {
		if (Math.abs(aspect - preset.value) < 0.01) {
			return preset.label;
		}
	}
	return "Freeform";
}

async function main() {
	const dryRun = process.argv.includes("--dry-run");

	if (dryRun) {
		console.log("=== DRY RUN MODE ===\n");
	}

	// Find all clip jobs that have cropSettings
	const clipJobs = await prisma.clipJob.findMany({
		where: {
			cropSettings: { not: undefined },
		},
		select: {
			id: true,
			cropSettings: true,
		},
	});

	console.log(`Found ${clipJobs.length} clip jobs with cropSettings`);

	let updated = 0;
	let skipped = 0;
	let noAspect = 0;

	for (const job of clipJobs) {
		const cropSettings = job.cropSettings as Record<string, unknown> | null;
		if (!cropSettings) {
			skipped++;
			continue;
		}

		// Skip if aspectLabel already exists
		if (cropSettings.aspectLabel) {
			skipped++;
			continue;
		}

		const aspect = cropSettings.aspect as number | undefined;
		if (aspect === undefined) {
			noAspect++;
			continue;
		}

		const aspectLabel = getAspectLabel(aspect);

		if (dryRun) {
			console.log(`  [DRY] ${job.id}: aspect=${aspect} -> "${aspectLabel}"`);
		} else {
			await prisma.clipJob.update({
				where: { id: job.id },
				data: {
					cropSettings: {
						...cropSettings,
						aspectLabel,
					},
				},
			});
		}
		updated++;
	}

	console.log(`\nResults:`);
	console.log(`  Updated: ${updated}`);
	console.log(`  Skipped (already has label or no cropSettings): ${skipped}`);
	console.log(`  No aspect value: ${noAspect}`);

	await prisma.$disconnect();
}

main().catch((e) => {
	console.error(e);
	prisma.$disconnect();
	process.exit(1);
});
