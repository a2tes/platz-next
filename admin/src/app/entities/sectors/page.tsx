"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Sector, sectorsService } from "@/services/sectorsService";
import { createStandardActions, createEntitiesNavigation } from "@/lib/entity-list-helpers";
import { SectorsModal } from "@/components/entities/SectorsModal";
import { IconBuildingFactory2 } from "@tabler/icons-react";
import { Column, renderDateColumn } from "@/components/ui/data-list";

// Extended Sector type with title for BaseEntity compatibility
interface SectorWithTitle extends Sector {
	title: string;
}

// Adapter to convert Sector to modal props
function SectorsModalAdapter({
	open,
	onOpenChange,
	item,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: SectorWithTitle | null;
	onSaved: () => void;
}) {
	return <SectorsModal open={open} onOpenChange={onOpenChange} sector={item} onSaved={onSaved} />;
}

// Create columns for sectors (using name instead of title)
function createSectorColumns(): Column<SectorWithTitle>[] {
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

// Wrap the service to match EntityService interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sectorEntityService: EntityService<SectorWithTitle> = {
	getItems: async (params) => {
		const result = await sectorsService.getSectors(params as any);
		return {
			data: result.sectors.map((s) => ({ ...s, title: s.name })),
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
		const result = await sectorsService.getTrashedSectors(params as any);
		return {
			data: result.sectors.map((s) => ({ ...s, title: s.name })),
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
	getCounts: sectorsService.getCounts as any,
	deleteItem: sectorsService.deleteSector,
	purgeItem: sectorsService.purgeSector,
	restoreItem: sectorsService.restoreSector as any,
	publishItem: sectorsService.publishSector as any,
	unpublishItem: sectorsService.unpublishSector as any,
	bulkDeleteItems: sectorsService.bulkDeleteSectors,
	bulkPurgeItems: sectorsService.bulkPurgeSectors,
};

const sectorsConfig: EntityListConfig<SectorWithTitle> = {
	// Entity info
	entityName: "sector",
	entityNamePlural: "sectors",
	entityDisplayName: "Sector",
	entityDisplayNamePlural: "Sectors",
	entityDescription: "Manage sectors that can be associated with Works.",

	// Icon
	icon: <IconBuildingFactory2 className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "sectors",
	countsQueryKey: "sectors-counts",
	trashedQueryKey: "trashed-sectors",

	// Service
	service: sectorEntityService,

	// UI
	columns: createSectorColumns(),
	getActions: createStandardActions<SectorWithTitle>(),

	// Edit mode
	editMode: "modal",
	EditorModal: SectorsModalAdapter,

	// Navigation
	navigation: createEntitiesNavigation({ currentPath: "/entities/sectors" }),
};

function SectorsPageContent() {
	return <EntityListPage config={sectorsConfig} />;
}

export default function SectorsPage() {
	return (
		<ProtectedRoute>
			<SectorsPageContent />
		</ProtectedRoute>
	);
}
