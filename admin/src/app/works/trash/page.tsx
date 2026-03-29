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
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { WorksService, Work } from "../../../services/worksService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

function WorksTrashPageContent() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedSearch, setDebouncedSearch] = React.useState("");
	const [selectedWork, setSelectedWork] = React.useState<Work | null>(null);
	const [action, setAction] = React.useState<"restore" | "purge" | null>(null);
	const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
	const [isBulkRunning, setIsBulkRunning] = React.useState(false);
	// Debounce search
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Fetch trashed works
	const {
		data: trashedData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["trashed-works", debouncedSearch],
		queryFn: () =>
			WorksService.getTrashedWorks({
				search: debouncedSearch || undefined,
				limit: 100,
			}),
	});

	// Restore mutation
	const restoreMutation = useMutation({
		mutationFn: (id: number) => WorksService.restoreWork(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-works"] });
			queryClient.invalidateQueries({ queryKey: ["works"] });
			queryClient.invalidateQueries({ queryKey: ["works-counts"] });
			setSelectedWork(null);
			setAction(null);
		},
	});

	// Purge mutation
	const purgeMutation = useMutation({
		mutationFn: (id: number) => WorksService.purgeWork(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-works"] });
			queryClient.invalidateQueries({ queryKey: ["works-counts"] });
			setSelectedWork(null);
			setAction(null);
		},
	});

	const handleRestore = (work: Work) => {
		setSelectedWork(work);
		setAction("restore");
	};

	const handlePurge = (work: Work) => {
		setSelectedWork(work);
		setAction("purge");
	};

	const confirmAction = () => {
		if (!selectedWork) return;

		if (action === "restore") {
			restoreMutation.mutate(selectedWork.id);
		} else if (action === "purge") {
			purgeMutation.mutate(selectedWork.id);
		}
	};

	const trashedWorks = trashedData?.data || [];

	// Selection helpers
	const toggleSelect = (id: number, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const toggleSelectAll = (ids: number[], checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) ids.forEach((id) => next.add(id));
			else ids.forEach((id) => next.delete(id));
			return next;
		});
	};

	const runBulk = async (bulkAction: "restore" | "purge") => {
		if (selectedIds.size === 0) return;
		setIsBulkRunning(true);
		try {
			const ids = Array.from(selectedIds);
			const calls = ids.map((id) =>
				bulkAction === "restore"
					? WorksService.restoreWork(id)
					: WorksService.purgeWork(id)
			);
			await Promise.allSettled(calls);
			queryClient.invalidateQueries({ queryKey: ["trashed-works"] });
			queryClient.invalidateQueries({ queryKey: ["works-counts"] });
			setSelectedIds(new Set());
		} finally {
			setIsBulkRunning(false);
		}
	};

	return (
		<AdminLayout>
			<div className="flex-1 space-y-6">
				{/* Header */}
				<div className="space-y-4">
					<div className="flex items-start justify-between">
						<div>
							<h1 className="text-4xl font-bold tracking-tight text-foreground">
								Trash
							</h1>
							<p className="text-sm text-muted-foreground mt-1">
								Recover deleted works or permanently remove them
							</p>
						</div>
						<Button
							onClick={() => router.back()}
							variant="outline"
							className="gap-2"
						>
							Back
						</Button>
					</div>

					{/* Search */}
					<div className="relative w-full sm:w-96">
						<IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search trashed works..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>
				</div>

				{/* Bulk action bar */}
				{trashedWorks.length > 0 && (
					<div className="flex items-center justify-between gap-3 p-3 border rounded-md bg-muted/40">
						<div className="flex items-center gap-3">
							{(() => {
								const allSelected =
									trashedWorks.length > 0 &&
									trashedWorks.every((w) => selectedIds.has(w.id));
								const someSelected = trashedWorks.some((w) =>
									selectedIds.has(w.id)
								);
								const checked = allSelected
									? true
									: someSelected
									? ("indeterminate" as const)
									: false;
								return (
									<Checkbox
										aria-label="Select all"
										checked={checked}
										onCheckedChange={(value) =>
											toggleSelectAll(
												trashedWorks.map((w) => w.id),
												Boolean(value)
											)
										}
										className="h-4 w-4"
									/>
								);
							})()}
							<span className="text-sm text-muted-foreground">
								Selected {selectedIds.size}
							</span>
						</div>
						<div className="flex gap-2">
							<Button
								size="sm"
								variant="outline"
								disabled={isBulkRunning || selectedIds.size === 0}
								onClick={() => runBulk("restore")}
							>
								Restore Selected
							</Button>
							<Button
								size="sm"
								variant="destructive"
								disabled={isBulkRunning || selectedIds.size === 0}
								onClick={() => runBulk("purge")}
							>
								Purge Selected
							</Button>
						</div>
					</div>
				)}

				{/* Content Area */}
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-20 px-4">
						<IconLoader2 className="h-10 w-10 text-muted-foreground animate-spin mb-3" />
						<p className="text-muted-foreground">Loading trash...</p>
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center py-20 px-4">
						<div className="rounded-full bg-destructive/10 p-4 mb-4">
							<IconAlertCircle className="h-8 w-8 text-destructive" />
						</div>
						<p className="text-destructive font-medium">Failed to load trash</p>
						<p className="text-sm text-muted-foreground mt-1">
							Please try again later
						</p>
					</div>
				) : trashedWorks.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 px-4">
						<div className="rounded-full bg-muted p-4 mb-4">
							<IconTrash className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="font-semibold text-foreground mb-1">
							Trash is empty
						</h3>
						<p className="text-sm text-muted-foreground">
							No deleted works to recover
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{trashedWorks.map((work) => (
							<div
								key={work.id}
								className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
							>
								<div className="flex items-start gap-3 flex-1 min-w-0">
									<Checkbox
										aria-label={`Select work ${work.title}`}
										checked={selectedIds.has(work.id)}
										onCheckedChange={(value) =>
											toggleSelect(work.id, Boolean(value))
										}
										className="h-4 w-4 mt-1"
									/>
									<div className="flex-1 min-w-0">
										<h3 className="font-medium text-foreground truncate">
											{work.title}
										</h3>
										<p className="text-sm text-muted-foreground">
											{work.client}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2 ml-4">
									<Button
										onClick={() => handleRestore(work)}
										variant="outline"
										size="sm"
										disabled={
											restoreMutation.isPending || purgeMutation.isPending
										}
										className="gap-2"
									>
										<IconRotateClockwise className="h-4 w-4" />
										Restore
									</Button>
									<Button
										onClick={() => handlePurge(work)}
										variant="ghost"
										size="sm"
										disabled={
											restoreMutation.isPending || purgeMutation.isPending
										}
										className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
									>
										<IconTrashOff className="h-4 w-4" />
										Purge
									</Button>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Action Confirmation Dialog */}
				<AlertDialog
					open={!!selectedWork}
					onOpenChange={(open) => !open && setSelectedWork(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{action === "restore" ? "Restore Work" : "Permanently Delete"}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{action === "restore" ? (
									<>
										Restore &ldquo;
										<span className="font-semibold">{selectedWork?.title}</span>
										&rdquo; to your works list?
									</>
								) : (
									<>
										Permanently delete &ldquo;
										<span className="font-semibold">{selectedWork?.title}</span>
										&rdquo;? This action cannot be undone.
									</>
								)}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={confirmAction}
								disabled={restoreMutation.isPending || purgeMutation.isPending}
								className={
									action === "purge"
										? "bg-destructive text-white hover:bg-destructive/90"
										: ""
								}
							>
								{restoreMutation.isPending || purgeMutation.isPending ? (
									<>
										<IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
										{action === "restore" ? "Restoring..." : "Deleting..."}
									</>
								) : action === "restore" ? (
									"Restore"
								) : (
									"Delete"
								)}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</AdminLayout>
	);
}

export default function WorksTrashPage() {
	return (
		<ProtectedRoute>
			<WorksTrashPageContent />
		</ProtectedRoute>
	);
}
