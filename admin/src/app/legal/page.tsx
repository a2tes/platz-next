"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
	EntityListPage,
	EntityListConfig,
	EntityService,
	type BaseEntity,
} from "@/components/page/entity-list-page";
import { ContentService, type ContentPage } from "@/services/contentService";
import { createStandardColumns } from "@/lib/entity-list-helpers";
import { IconFileText } from "@tabler/icons-react";

type LegalEntity = ContentPage & BaseEntity;

const legalService: EntityService<LegalEntity> = {
	async getItems(params) {
		// Map to ContentService params
		const resp = await ContentService.getLegalPaginated({
			page: params.page,
			limit: params.limit,
			search: params.search,
			status: params.status,
			mine: params.mine,
		});
		return {
			data: resp.data as LegalEntity[],
			meta: resp.meta,
		};
	},
	async getTrashedItems(params) {
		const resp = await ContentService.getTrashedLegal({
			page: params.page,
			limit: params.limit,
			search: params.search,
		});
		return {
			data: resp.data as LegalEntity[],
			meta: resp.meta,
		};
	},
	async getCounts() {
		return ContentService.getLegalCounts();
	},
	// Deletion (hard delete on backend)
	async deleteItem(id) {
		await ContentService.deleteLegalById(id);
	},
	async purgeItem(id) {
		await ContentService.purgeLegalById(id);
	},
	async restoreItem(id) {
		await ContentService.restoreLegalById(id);
	},
	async updateItem(id, data) {
		// Minimal update support (title/status)
		const payload: { title?: string; status?: "PUBLISHED" | "DRAFT" } = {};
		if (typeof data.title === "string") payload.title = data.title;
		if (data.status === "PUBLISHED" || data.status === "DRAFT")
			payload.status = data.status;
		const updated = await ContentService.updateLegalById(id, payload);
		return updated as unknown as LegalEntity;
	},
	async publishItem(id) {
		return ContentService.publishLegalById(
			id
		) as unknown as Promise<LegalEntity>;
	},
	async unpublishItem(id) {
		return ContentService.unpublishLegalById(
			id
		) as unknown as Promise<LegalEntity>;
	},
	async bulkDeleteItems(ids) {
		await ContentService.bulkDeleteLegal(ids);
	},
	async bulkRestoreItems(ids) {
		await ContentService.bulkRestoreLegal(ids);
	},
	async bulkPurgeItems(ids) {
		await ContentService.bulkPurgeLegal(ids);
	},
	async bulkPublish(ids) {
		await ContentService.bulkPublishLegal(ids);
		return { publishedIds: ids, failed: [] };
	},
	async bulkUnpublish(ids) {
		await ContentService.bulkUnpublishLegal(ids);
		return { unpublishedIds: ids, failed: [] };
	},
};

const legalConfig: EntityListConfig<LegalEntity> = {
	entityName: "legal page",
	entityNamePlural: "legal pages",
	entityDisplayName: "Legal Page",
	entityDisplayNamePlural: "Legal Pages",
	entityDescription: "Manage your legal pages (Privacy, Terms, etc.)",
	icon: <IconFileText className="h-8 w-8 text-muted-foreground" />,

	queryKey: "legal-pages",
	countsQueryKey: "legal-pages-counts",
	trashedQueryKey: "trashed-legal-pages",

	service: legalService,

	columns: createStandardColumns<LegalEntity>(),
	getActions: ({ filterTab, onTogglePublish, onDelete, onRestore }) => {
		return [
			{
				label: "Edit",
				onClick: (item) => {
					window.location.href = `/legal/${item.id}/edit`;
				},
				show: () => filterTab !== "trash",
			},
			{
				label: (item) =>
					item.status === "PUBLISHED" ? "Unpublish" : "Publish",
				onClick: onTogglePublish,
				show: () => filterTab !== "trash",
			},
			{
				label: "Restore",
				onClick: onRestore!,
				show: () => filterTab === "trash",
			},
			{
				label: filterTab === "trash" ? "Delete Permanently" : "Delete",
				onClick: onDelete,
				className: "text-destructive hover:underline",
				show: () => true,
			},
		];
	},

	// Open the editor form directly via route for creation
	editMode: "route",
	editRoute: "/legal",
};

function LegalPageContent() {
	return <EntityListPage config={legalConfig} />;
}

export default function LegalListPage() {
	return (
		<ProtectedRoute>
			<LegalPageContent />
		</ProtectedRoute>
	);
}
