"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { getTaxonomyService, Taxonomy, TaxonomyTypeSlug } from "@/services/taxonomyService";
import { createStandardActions, createPhotographyNavigation } from "@/lib/entity-list-helpers";
import { TaxonomyModal } from "@/components/entities/TaxonomyModal";
import { IconPhoto } from "@tabler/icons-react";
import { Column, renderDateColumn } from "@/components/ui/data-list";

// Extended type with title for BaseEntity compatibility
interface TaxonomyWithTitle extends Taxonomy {
	title: string;
}

const TYPE_SLUG: TaxonomyTypeSlug = "photo-categories";

function createCategoryColumns(): Column<TaxonomyWithTitle>[] {
	return [
		{
			key: "name",
			header: "Name",
			render: (item) => (
				<>
					<h3 className="font-semibold text-foreground line-clamp-2 inline">{item.name}</h3>
					{item.status === "DRAFT" && <span className="text-sm text-muted-foreground pl-2 italic">— Draft</span>}
				</>
			),
		},
		{
			key: "usage",
			header: "Used In",
			width: "w-52",
			render: (item) => {
				if (!item._count) return <span className="text-muted-foreground">-</span>;
				const parts = [];
				if (item._count.photography > 0)
					parts.push(`${item._count.photography} ${item._count.photography === 1 ? "photo" : "photos"}`);
				return <div className="text-sm text-muted-foreground">{parts.length > 0 ? parts.join(", ") : "-"}</div>;
			},
		},
		{
			key: "date",
			header: "Date",
			width: "w-44",
			render: (item) => renderDateColumn("Created", item.createdAt),
		},
	];
}

function CategoryModalAdapter({
	open,
	onOpenChange,
	item,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: TaxonomyWithTitle | null;
	onSaved: () => void;
}) {
	return (
		<TaxonomyModal
			open={open}
			onOpenChange={onOpenChange}
			taxonomy={item}
			onSaved={onSaved}
			typeSlug={TYPE_SLUG}
			displayName="Photo Category"
		/>
	);
}

function CategoriesPageContent() {
	const service = getTaxonomyService(TYPE_SLUG);

	const entityService: EntityService<TaxonomyWithTitle> = {
		getItems: async (params) => {
			const result = await service.getAll(params as any);
			return {
				data: result.taxonomies.map((t) => ({ ...t, title: t.name })),
				meta: {
					pagination: {
						page: result.pagination.page,
						limit: result.pagination.limit,
						totalPages: result.pagination.totalPages,
						totalItems: result.pagination.total,
					},
				},
			} as any;
		},
		getTrashedItems: async (params) => {
			const result = await service.getTrashed(params as any);
			return {
				data: result.taxonomies.map((t) => ({ ...t, title: t.name })),
				meta: {
					pagination: {
						page: result.pagination.page,
						limit: result.pagination.limit,
						totalPages: result.pagination.totalPages,
						totalItems: result.pagination.total,
					},
				},
			} as any;
		},
		getCounts: service.getCounts as any,
		deleteItem: service.delete,
		purgeItem: service.purge,
		restoreItem: service.restore as any,
		publishItem: service.publish as any,
		unpublishItem: service.unpublish as any,
		bulkDeleteItems: service.bulkDelete,
		bulkPurgeItems: service.bulkPurge,
	};

	const config: EntityListConfig<TaxonomyWithTitle> = {
		entityName: "photo-category",
		entityNamePlural: "photo-categories",
		entityDisplayName: "Photo Category",
		entityDisplayNamePlural: "Photo Categories",
		entityDescription: "Manage categories for your photography portfolio.",
		icon: <IconPhoto className="h-8 w-8 text-muted-foreground" />,
		queryKey: `taxonomies-${TYPE_SLUG}`,
		countsQueryKey: `taxonomies-${TYPE_SLUG}-counts`,
		trashedQueryKey: `taxonomies-${TYPE_SLUG}-trashed`,
		service: entityService,
		columns: createCategoryColumns(),
		getActions: createStandardActions<TaxonomyWithTitle>(),
		editMode: "modal",
		EditorModal: CategoryModalAdapter,
		navigation: createPhotographyNavigation({
			currentPath: "/photography/categories",
		}),
	};

	return <EntityListPage config={config} />;
}

export default function PhotoCategoriesPage() {
	return (
		<ProtectedRoute>
			<CategoriesPageContent />
		</ProtectedRoute>
	);
}
