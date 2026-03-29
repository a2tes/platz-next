"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EntityListPage, EntityListConfig, EntityService } from "@/components/page/entity-list-page";
import { Client, clientsService } from "@/services/clientsService";
import { createStandardActions, createEntitiesNavigation } from "@/lib/entity-list-helpers";
import { ClientsModal } from "@/components/entities/ClientsModal";
import { IconUsers } from "@tabler/icons-react";
import { Column, renderDateColumn } from "@/components/ui/data-list";

// Extended Client type with title for BaseEntity compatibility
interface ClientWithTitle extends Client {
	title: string;
}

// Adapter to convert Client to modal props
function ClientsModalAdapter({
	open,
	onOpenChange,
	item,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: ClientWithTitle | null;
	onSaved: () => void;
}) {
	return <ClientsModal open={open} onOpenChange={onOpenChange} client={item} onSaved={onSaved} />;
}

// Create columns for clients (using name instead of title)
function createClientColumns(): Column<ClientWithTitle>[] {
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
const clientEntityService: EntityService<ClientWithTitle> = {
	getItems: async (params) => {
		const result = await clientsService.getClients(params as any);
		return {
			data: result.clients.map((c) => ({ ...c, title: c.name })),
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
		const result = await clientsService.getTrashedClients(params as any);
		return {
			data: result.clients.map((c) => ({ ...c, title: c.name })),
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
	getCounts: clientsService.getCounts as any,
	deleteItem: clientsService.deleteClient,
	purgeItem: clientsService.purgeClient,
	restoreItem: clientsService.restoreClient as any,
	publishItem: clientsService.publishClient as any,
	unpublishItem: clientsService.unpublishClient as any,
	bulkDeleteItems: clientsService.bulkDeleteClients,
	bulkPurgeItems: clientsService.bulkPurgeClients,
};

const clientsConfig: EntityListConfig<ClientWithTitle> = {
	// Entity info
	entityName: "client",
	entityNamePlural: "clients",
	entityDisplayName: "Client",
	entityDisplayNamePlural: "Clients",
	entityDescription: "Manage clients that can be associated with Works, Photography, and Animations.",

	// Icon
	icon: <IconUsers className="h-8 w-8 text-muted-foreground" />,

	// Query keys
	queryKey: "clients",
	countsQueryKey: "clients-counts",
	trashedQueryKey: "trashed-clients",

	// Service
	service: clientEntityService,

	// UI
	columns: createClientColumns(),
	getActions: createStandardActions<ClientWithTitle>(),

	// Edit mode
	editMode: "modal",
	EditorModal: ClientsModalAdapter,

	// Navigation
	navigation: createEntitiesNavigation({ currentPath: "/entities/clients" }),
};

function ClientsPageContent() {
	return <EntityListPage config={clientsConfig} />;
}

export default function ClientsPage() {
	return (
		<ProtectedRoute>
			<ClientsPageContent />
		</ProtectedRoute>
	);
}
