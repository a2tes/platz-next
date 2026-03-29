"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	IconPencil,
	IconCheck,
	IconX,
	IconArrowUpRight,
	IconChevronLeft,
} from "@tabler/icons-react";
import { toast } from "sonner";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { WorkForm } from "@/components/works/WorkForm";
import { WorksService } from "@/services/worksService";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EditWorkPage() {
	const router = useRouter();
	const params = useParams();
	const queryClient = useQueryClient();
	const workId = parseInt(params.id as string, 10);
	const [isEditingTitle, setIsEditingTitle] = React.useState(false);
	const [editedTitle, setEditedTitle] = React.useState("");
	const publicUrl =
		`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}` ||
		`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

	const {
		data: work,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["work", workId],
		queryFn: () => WorksService.getWork(workId),
		enabled: !isNaN(workId),
	});

	const updateTitleMutation = useMutation({
		mutationFn: (title: string) => WorksService.updateWorkTitle(workId, title),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["work", workId],
			});
			toast.success("Title updated successfully");
			setIsEditingTitle(false);
		},
		onError: () => {
			toast.error("Failed to update title");
		},
	});

	const handleEditTitle = () => {
		setEditedTitle(work?.title || "");
		setIsEditingTitle(true);
	};

	const handleSaveTitle = () => {
		if (editedTitle.trim()) {
			updateTitleMutation.mutate(editedTitle.trim());
		}
	};

	const handleCancelEdit = () => {
		setIsEditingTitle(false);
		setEditedTitle("");
	};

	return (
		<ProtectedRoute>
			<AdminLayout>
				<div className="flex-1">
					<div className="mb-6">
						{isLoading ? (
							<>
								<Skeleton className="h-9 w-64 mb-2" />
								<Skeleton className="h-4 w-48" />
							</>
						) : isEditingTitle ? (
							<>
								<div className="flex items-center gap-2">
									<Input
										value={editedTitle}
										onChange={(e) => setEditedTitle(e.target.value)}
										className="text-3xl font-bold tracking-tight h-auto py-2"
										autoFocus
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleSaveTitle();
											} else if (e.key === "Escape") {
												handleCancelEdit();
											}
										}}
									/>
									<Button
										size="sm"
										variant="ghost"
										onClick={handleSaveTitle}
										disabled={updateTitleMutation.isPending}
									>
										<IconCheck className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={handleCancelEdit}
										disabled={updateTitleMutation.isPending}
									>
										<IconX className="h-4 w-4" />
									</Button>
								</div>
								{work && (
									<a
										href={`${publicUrl}/works/${work.slug}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1 hover:text-foreground transition-colors group"
									>
										<span className="group-hover:underline">
											{publicUrl}/works/{work.slug}
										</span>
										<IconArrowUpRight className="h-3 w-3" />
									</a>
								)}
							</>
						) : (
							<>
								<div className="flex flex-col sm:flex-row justify-between sm:items-center">
									<div className="flex flex-col">
										<div className="flex items-center gap-3">
											<h1 className="text-3xl font-bold tracking-tight">
												{work?.title || "Edit Work"}
											</h1>
											{work && (
												<button
													onClick={handleEditTitle}
													className="p-2 hover:bg-muted rounded-md transition-colors"
												>
													<IconPencil className="h-5 w-5 text-muted-foreground" />
												</button>
											)}
										</div>
										{work && (
											<a
												href={`${publicUrl}/works/${work.slug}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1 hover:text-foreground transition-colors group"
											>
												<span className="group-hover:underline">
													{publicUrl}/works/{work.slug}
												</span>
												<IconArrowUpRight className="h-3 w-3" />
											</a>
										)}
									</div>
									<Button
										variant="outline"
										onClick={() => router.push("/works")}
										className="mt-4 sm:mt-0"
									>
										<IconChevronLeft className="w-4 h-4" />
										Back to works
									</Button>
								</div>
							</>
						)}
					</div>

					{isLoading && (
						<div className="space-y-4">
							<Skeleton className="h-64 w-full" />
							<Skeleton className="h-96 w-full" />
						</div>
					)}

					{isError && (
						<div className="text-center py-12">
							<p className="text-red-600">Error loading work</p>
						</div>
					)}

					{work && (
						<WorkForm
							work={work}
							onClose={() => router.push("/works")}
							onSuccess={() => {
								// Stay on the page after successful update
								// React Query will handle cache invalidation
							}}
						/>
					)}
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
