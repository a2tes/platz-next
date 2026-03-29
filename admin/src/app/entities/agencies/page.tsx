"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Agency, agenciesService } from "@/services/agenciesService";
import { createStandardActions, createEntitiesNavigation } from "@/lib/entity-list-helpers";
import { AgenciesModal } from "@/components/entities/AgenciesModal";
import { IconBuilding } from "@tabler/icons-react";
import { Column, renderDateColumn } from "@/components/ui/data-list";

// Extended Agency type with title for BaseEntity compatibility
interface AgencyWithTitle extends Agency {
	title: string;
}

// Adapter to convert Agency to modal props
function AgenciesModalAdapter({
	open,
	onOpenChange,
	item,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: AgencyWithTitle | null;
	onSaved: () => void;
}) {
	return <AgenciesModal open={open} onOpenChange={onOpenChange} agency={item} onSaved={onSaved} />;
}

// Create columns for agencies (using name instead of title)
function createAgencyColumns(): Column<AgencyWithTitle>[] {
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

// Wrap the service to match EntityService interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const agencyEntityService: EntityService<AgencyWithTitle> = {
	getItems: async (params) => {
		const result = await agenciesService.getAgencies(params as any);
		return {
			data: result.agencies.map((a) => ({ ...a, title: a.name })),
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
		const result = await agenciesService.getTrashedAgencies(params as any);
		return {
			data: result.agencies.map((a) => ({ ...a, title: a.name })),
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
	getCounts: agenciesService.getCounts as any,
	deleteItem: agenciesService.deleteAgency,
	purgeItem: agenciesService.purgeAgency,
	restoreItem: agenciesService.restoreAgency as any,
	publishItem: agenciesService.publishAgency as any,
	unpublishItem: agenciesService.unpublishAgency as any,
	bulkDeleteItems: agenciesService.bulkDeleteAgencies,
	bulkPurgeItems: agenciesService.bulkPurgeAgencies,
};

const agenciesConfig: EntityListConfig<AgencyWithTitle> = {
	// Entity info
	entityName: "agency",
	entityNamePlural: "agencies",
	entityDisplayName: "Agency",
	entityDisplayNamePlural: "Agencies",
	entityDescription: "Manage agencies that can be associated with Works, Photography, and Animations.",

	// Icon
	icon: <IconBuilding className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "agencies",
	countsQueryKey: "agencies-counts",
	trashedQueryKey: "trashed-agencies",

	// Service
	service: agencyEntityService,

	// UI
	columns: createAgencyColumns(),
	getActions: createStandardActions<AgencyWithTitle>(),

	// Edit mode
	editMode: "modal",
	EditorModal: AgenciesModalAdapter,

	// Navigation
	navigation: createEntitiesNavigation({ currentPath: "/entities/agencies" }),
};

function AgenciesPageContent() {
	return <EntityListPage config={agenciesConfig} />;
}

export default function AgenciesPage() {
	return (
		<ProtectedRoute>
			<AgenciesPageContent />
		</ProtectedRoute>
	);
}
