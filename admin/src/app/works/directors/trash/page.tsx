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
import ProtectedRoute from "../../../../components/auth/ProtectedRoute";
import { WorksService, Director } from "../../../../services/worksService";
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

function DirectorsTrashPageContent() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedSearch, setDebouncedSearch] = React.useState("");
	const [selectedDirector, setSelectedDirector] =
		React.useState<Director | null>(null);
	const [action, setAction] = React.useState<"restore" | "purge" | null>(null);

	// Debounce search
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Fetch trashed directors
	const {
		data: trashedData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["trashed-directors", debouncedSearch],
		queryFn: () =>
			WorksService.getTrashedDirectors({
				search: debouncedSearch || undefined,
				limit: 100,
			}),
	});

	// Restore mutation
	const restoreMutation = useMutation({
		mutationFn: (id: number) => WorksService.restoreDirector(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-directors"] });
			queryClient.invalidateQueries({ queryKey: ["directors"] });
			setSelectedDirector(null);
			setAction(null);
		},
	});

	// Purge mutation
	const purgeMutation = useMutation({
		mutationFn: (id: number) => WorksService.purgeDirector(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trashed-directors"] });
			setSelectedDirector(null);
			setAction(null);
		},
	});

	const handleRestore = (director: Director) => {
		setSelectedDirector(director);
		setAction("restore");
	};

	const handlePurge = (director: Director) => {
		setSelectedDirector(director);
		setAction("purge");
	};

	const confirmAction = () => {
		if (!selectedDirector) return;

		if (action === "restore") {
			restoreMutation.mutate(selectedDirector.id);
		} else if (action === "purge") {
			purgeMutation.mutate(selectedDirector.id);
		}
	};

	const trashedDirectors = trashedData?.data || [];

	return (
		<AdminLayout>
			<div className="flex-1 space-y-6">
				{/* Header */}
				<div className="space-y-4">
					<div className="flex items-start justify-between">
						<div>
							<h1 className="text-4xl font-bold tracking-tight text-foreground">
								Trash - Directors
							</h1>
							<p className="text-sm text-muted-foreground mt-1">
								Recover deleted directors or permanently remove them
							</p>
						</div>
						<Button
							onClick={() => router.push("/directors")}
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
							placeholder="Search trashed directors..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>
				</div>

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
				) : trashedDirectors.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 px-4">
						<div className="rounded-full bg-muted p-4 mb-4">
							<IconTrash className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="font-semibold text-foreground mb-1">
							Trash is empty
						</h3>
						<p className="text-sm text-muted-foreground">
							No deleted directors to recover
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{trashedDirectors.map((director: Director) => (
							<div
								key={director.id}
								className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
							>
								<div className="flex-1 min-w-0">
									<h3 className="font-medium text-foreground truncate">
										{director.title}
									</h3>
									<p className="text-sm text-muted-foreground truncate">
										{director.shortDescription}
									</p>
								</div>
								<div className="flex items-center gap-2 ml-4">
									<Button
										onClick={() => handleRestore(director)}
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
										onClick={() => handlePurge(director)}
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
					open={!!selectedDirector}
					onOpenChange={(open) => !open && setSelectedDirector(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{action === "restore"
									? "Restore Director"
									: "Permanently Delete"}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{action === "restore" ? (
									<>
										Restore &ldquo;
										<span className="font-semibold">
											{selectedDirector?.title}
										</span>
										&rdquo; to your directors list?
									</>
								) : (
									<>
										Permanently delete &ldquo;
										<span className="font-semibold">
											{selectedDirector?.title}
										</span>
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

export default function DirectorsTrashPage() {
	return (
		<ProtectedRoute>
			<DirectorsTrashPageContent />
		</ProtectedRoute>
	);
}
