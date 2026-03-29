"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	IconSearch,
	IconLoader2,
	IconAlertCircle,
	IconTrash,
	IconRotateClockwise,
	IconTrashOff,
} from "@tabler/icons-react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Agency, agenciesService } from "@/services/agenciesService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminLayout } from "@/components/layout/admin-layout";

function AgenciesTrashPageContent() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [search, setSearch] = React.useState("");
	const [page, setPage] = React.useState(1);
	const [itemToRestore, setItemToRestore] = React.useState<Agency | null>(null);
	const [itemToPurge, setItemToPurge] = React.useState<Agency | null>(null);

	const { data, isLoading, error } = useQuery({
		queryKey: ["trashed-agencies", { page, search }],
		queryFn: () => agenciesService.getTrashedAgencies({ page, limit: 20, search }),
	});

	const restoreMutation = useMutation({
		mutationFn: (id: number) => agenciesService.restoreAgency(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-agencies"] });
			queryClient.invalidateQueries({ queryKey: ["agencies"] });
			queryClient.invalidateQueries({ queryKey: ["agencies-counts"] });
			setItemToRestore(null);
		},
	});

	const purgeMutation = useMutation({
		mutationFn: (id: number) => agenciesService.purgeAgency(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-agencies"] });
			queryClient.invalidateQueries({ queryKey: ["agencies-counts"] });
			setItemToPurge(null);
		},
	});

	const items = data?.agencies || [];
	const pagination = data?.pagination;

	return (
		<AdminLayout>
			<div className="container max-w-6xl py-8">
				{/* Header */}
				<div className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-3xl font-bold">Trashed Agencies</h1>
						<p className="text-muted-foreground mt-1">Restore or permanently delete trashed agencies</p>
					</div>
					<Button variant="outline" onClick={() => router.push("/entities/agencies")}>
						Back to Agencies
					</Button>
				</div>

				{/* Search */}
				<div className="relative mb-6">
					<IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search trashed agencies..."
						className="pl-10"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
					/>
				</div>

				{/* Content */}
				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center py-12 text-destructive">
						<IconAlertCircle className="h-8 w-8 mb-2" />
						<p>Failed to load trashed agencies</p>
					</div>
				) : items.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
						<IconTrashOff className="h-12 w-12 mb-4" />
						<p className="text-lg font-medium">Trash is empty</p>
						<p className="text-sm">Deleted agencies will appear here</p>
					</div>
				) : (
					<div className="space-y-2">
						{items.map((item) => (
							<div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
								<div>
									<h3 className="font-medium">{item.name}</h3>
									<p className="text-sm text-muted-foreground">/{item.slug}</p>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setItemToRestore(item)}
										disabled={restoreMutation.isPending}
									>
										<IconRotateClockwise className="h-4 w-4 mr-1" />
										Restore
									</Button>
									<Button
										variant="destructive"
										size="sm"
										onClick={() => setItemToPurge(item)}
										disabled={purgeMutation.isPending}
									>
										<IconTrash className="h-4 w-4 mr-1" />
										Delete
									</Button>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Pagination */}
				{pagination && pagination.totalPages > 1 && (
					<div className="flex items-center justify-center gap-2 mt-6">
						<Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
							Previous
						</Button>
						<span className="text-sm text-muted-foreground">
							Page {page} of {pagination.totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={page === pagination.totalPages}
							onClick={() => setPage((p) => p + 1)}
						>
							Next
						</Button>
					</div>
				)}
			</div>

			{/* Restore Dialog */}
			<AlertDialog open={!!itemToRestore} onOpenChange={() => setItemToRestore(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Restore Agency</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to restore "{itemToRestore?.name}"? It will be moved back to your agencies list.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => itemToRestore && restoreMutation.mutate(itemToRestore.id)}>
							Restore
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Purge Dialog */}
			<AlertDialog open={!!itemToPurge} onOpenChange={() => setItemToPurge(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Permanently</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to permanently delete "{itemToPurge?.name}"? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => itemToPurge && purgeMutation.mutate(itemToPurge.id)}
						>
							Delete Permanently
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AdminLayout>
	);
}

export default function AgenciesTrashPage() {
	return (
		<ProtectedRoute>
			<AgenciesTrashPageContent />
		</ProtectedRoute>
	);
}
