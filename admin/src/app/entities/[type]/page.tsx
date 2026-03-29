"use client";

import { useParams, notFound } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { getTaxonomyService, Taxonomy, TaxonomyTypeSlug } from "@/services/taxonomyService";
import { createStandardActions } from "@/lib/entity-list-helpers";
import { TaxonomyModal } from "@/components/entities/TaxonomyModal";
import { IconUsers, IconBriefcase, IconCategory, IconPhoto } from "@tabler/icons-react";
import { Column, renderDateColumn } from "@/components/ui/data-list";
import { NavigationItem } from "@/components/page/entity-list-page";

// Taxonomy type configuration
interface TaxonomyTypeConfig {
	typeSlug: TaxonomyTypeSlug;
	displayName: string;
	displayNamePlural: string;
	description: string;
	icon: React.ReactNode;
}

const TAXONOMY_TYPES: Record<string, TaxonomyTypeConfig> = {
	clients: {
		typeSlug: "clients",
		displayName: "Client",
		displayNamePlural: "Clients",
		description: "Manage clients that can be associated with Works, Photography, and Animations.",
		icon: <IconUsers className="h-8 w-8 text-muted-foreground" />,
	},
	disciplines: {
		typeSlug: "disciplines",
		displayName: "Discipline",
		displayNamePlural: "Disciplines",
		description: "Manage disciplines that can be associated with Works.",
		icon: <IconBriefcase className="h-8 w-8 text-muted-foreground" />,
	},
	sectors: {
		typeSlug: "sectors",
		displayName: "Sector",
		displayNamePlural: "Sectors",
		description: "Manage sectors that can be associated with Works.",
		icon: <IconCategory className="h-8 w-8 text-muted-foreground" />,
	},
	"photo-categories": {
		typeSlug: "photo-categories",
		displayName: "Photo Category",
		displayNamePlural: "Photo Categories",
		description: "Manage categories for Photography items.",
		icon: <IconPhoto className="h-8 w-8 text-muted-foreground" />,
	},
};

// Extended type with title for BaseEntity compatibility
interface TaxonomyWithTitle extends Taxonomy {
	title: string;
}

function createTaxonomyNavigation(currentType: string): NavigationItem[] {
	return Object.entries(TAXONOMY_TYPES).map(([key, config]) => ({
		label: config.displayNamePlural,
		href: `/entities/${key}`,
		isActive: key === currentType,
	}));
}

function createTaxonomyColumns(): Column<TaxonomyWithTitle>[] {
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
				if (item._count.works > 0) parts.push(`${item._count.works} ${item._count.works === 1 ? "work" : "works"}`);
				if (item._count.photography > 0)
					parts.push(`${item._count.photography} ${item._count.photography === 1 ? "photo" : "photos"}`);
				if (item._count.animations > 0)
					parts.push(`${item._count.animations} ${item._count.animations === 1 ? "animation" : "animations"}`);
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

function TaxonomyPageContent({ typeConfig }: { typeConfig: TaxonomyTypeConfig }) {
	const service = getTaxonomyService(typeConfig.typeSlug);

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

	function TaxonomyModalAdapter({
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
				typeSlug={typeConfig.typeSlug}
				displayName={typeConfig.displayName}
			/>
		);
	}

	const config: EntityListConfig<TaxonomyWithTitle> = {
		entityName: typeConfig.typeSlug,
		entityNamePlural: typeConfig.typeSlug,
		entityDisplayName: typeConfig.displayName,
		entityDisplayNamePlural: typeConfig.displayNamePlural,
		entityDescription: typeConfig.description,
		icon: typeConfig.icon,
		queryKey: `taxonomies-${typeConfig.typeSlug}`,
		countsQueryKey: `taxonomies-${typeConfig.typeSlug}-counts`,
		trashedQueryKey: `taxonomies-${typeConfig.typeSlug}-trashed`,
		service: entityService,
		columns: createTaxonomyColumns(),
		getActions: createStandardActions<TaxonomyWithTitle>(),
		editMode: "modal",
		EditorModal: TaxonomyModalAdapter,
		navigation: createTaxonomyNavigation(typeConfig.typeSlug),
	};

	return <EntityListPage config={config} />;
}

export default function TaxonomyTypePage() {
	const params = useParams();
	const type = params.type as string;

	const typeConfig = TAXONOMY_TYPES[type];

	if (!typeConfig) {
		notFound();
	}

	return (
		<ProtectedRoute>
			<TaxonomyPageContent typeConfig={typeConfig} />
		</ProtectedRoute>
	);
}
