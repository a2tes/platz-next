/**
 * Migration script to convert EditorJS data to Quill format
 *
 * This script converts existing EditorJS content to Quill format in:
 * - ContentPage.contentBlocks
 *
 * Run with: npx ts-node scripts/migrateEditorJSToQuill.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

interface EditorJSBlock {
	type: string;
	data: Record<string, unknown>;
	tunes?: {
		alignment?: {
			alignment: "left" | "center" | "right" | "justify";
		};
	};
}

interface EditorJSData {
	time?: number;
	blocks: EditorJSBlock[];
	version?: string;
}

interface QuillData {
	html: string;
	format: "quill";
}

function isEditorJSData(data: unknown): data is EditorJSData {
	return typeof data === "object" && data !== null && "blocks" in data && Array.isArray((data as EditorJSData).blocks);
}

function isQuillData(data: unknown): data is QuillData {
	return typeof data === "object" && data !== null && "format" in data && (data as QuillData).format === "quill";
}

function convertEditorJSToQuill(editorData: EditorJSData): QuillData {
	const html = editorData.blocks
		.map((block) => {
			const alignment = block.tunes?.alignment?.alignment;
			const alignStyle = alignment && alignment !== "left" ? ` style="text-align: ${alignment}"` : "";

			switch (block.type) {
				case "paragraph":
					return `<p${alignStyle}>${(block.data.text as string) || ""}</p>`;

				case "header":
					const level = (block.data.level as number) || 2;
					return `<h${level}${alignStyle}>${(block.data.text as string) || ""}</h${level}>`;

				case "list":
					const tag = block.data.style === "ordered" ? "ol" : "ul";
					const items = ((block.data.items as string[]) || []).map((item) => `<li>${item}</li>`).join("");
					return `<${tag}${alignStyle}>${items}</${tag}>`;

				case "quote":
					return `<blockquote${alignStyle}>${(block.data.text as string) || ""}</blockquote>`;

				case "delimiter":
					return "<hr />";

				case "code":
					return `<pre><code>${(block.data.code as string) || ""}</code></pre>`;

				case "table":
					const content = (block.data.content as string[][]) || [];
					const hasHeader = block.data.withHeadings as boolean;
					let tableHtml = "<table>";
					if (hasHeader && content.length > 0) {
						tableHtml += "<thead><tr>";
						content[0].forEach((cell) => {
							tableHtml += `<th>${cell}</th>`;
						});
						tableHtml += "</tr></thead>";
					}
					tableHtml += "<tbody>";
					const startIdx = hasHeader ? 1 : 0;
					for (let i = startIdx; i < content.length; i++) {
						tableHtml += "<tr>";
						content[i].forEach((cell) => {
							tableHtml += `<td>${cell}</td>`;
						});
						tableHtml += "</tr>";
					}
					tableHtml += "</tbody></table>";
					return tableHtml;

				default:
					return "";
			}
		})
		.filter(Boolean)
		.join("\n");

	return { html, format: "quill" };
}

async function migrateContentPages() {
	console.log("Migrating ContentPage records...");

	const pages = await prisma.contentPage.findMany({
		where: {
			contentBlocks: {
				not: undefined,
			},
		},
	});

	let migrated = 0;
	let skipped = 0;

	for (const page of pages) {
		const contentBlocks = page.contentBlocks as unknown;

		if (!contentBlocks) {
			skipped++;
			continue;
		}

		// Skip if already Quill format
		if (isQuillData(contentBlocks)) {
			console.log(`  [SKIP] ContentPage ${page.id} (${page.slug}): Already Quill format`);
			skipped++;
			continue;
		}

		// Convert EditorJS to Quill
		if (isEditorJSData(contentBlocks)) {
			const quillData = convertEditorJSToQuill(contentBlocks);

			await prisma.contentPage.update({
				where: { id: page.id },
				data: { contentBlocks: quillData as unknown as Prisma.InputJsonValue },
			});

			console.log(`  [MIGRATED] ContentPage ${page.id} (${page.slug})`);
			migrated++;
		} else {
			console.log(`  [SKIP] ContentPage ${page.id} (${page.slug}): Unknown format`);
			skipped++;
		}
	}

	console.log(`ContentPage migration complete: ${migrated} migrated, ${skipped} skipped`);
	return { migrated, skipped };
}

async function main() {
	console.log("=".repeat(60));
	console.log("EditorJS to Quill Migration Script");
	console.log("=".repeat(60));
	console.log();

	try {
		const contentResult = await migrateContentPages();

		console.log();
		console.log("=".repeat(60));
		console.log("Migration Summary");
		console.log("=".repeat(60));
		console.log(`ContentPages: ${contentResult.migrated} migrated, ${contentResult.skipped} skipped`);
		console.log();
		console.log("Migration complete!");
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
