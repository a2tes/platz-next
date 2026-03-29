"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconPencil, IconCheck, IconX, IconArrowUpRight, IconChevronLeft } from "@tabler/icons-react";
import { toast } from "sonner";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AnimationForm } from "@/components/animations/AnimationForm";
import { AnimationsService } from "@/services/animationsService";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EditAnimationPage() {
	const router = useRouter();
	const params = useParams();
	const queryClient = useQueryClient();
	const animationId = parseInt(params.id as string, 10);
	const [isEditingTitle, setIsEditingTitle] = React.useState(false);
	const [editedTitle, setEditedTitle] = React.useState("");
	const publicUrl =
		`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}` ||
		`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

	const {
		data: animation,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["animation", animationId],
		queryFn: () => AnimationsService.getAnimation(animationId),
		enabled: !isNaN(animationId),
	});

	const updateTitleMutation = useMutation({
		mutationFn: (title: string) => AnimationsService.updateAnimationTitle(animationId, title),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["animation", animationId],
			});
			toast.success("Title updated successfully");
			setIsEditingTitle(false);
		},
		onError: () => {
			toast.error("Failed to update title");
		},
	});

	const handleEditTitle = () => {
		setEditedTitle(animation?.title || "");
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
									<Button size="sm" variant="ghost" onClick={handleSaveTitle} disabled={updateTitleMutation.isPending}>
										<IconCheck className="h-4 w-4" />
									</Button>
									<Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={updateTitleMutation.isPending}>
										<IconX className="h-4 w-4" />
									</Button>
								</div>
								{animation && (
									<a
										href={`${publicUrl}/animations/${animation.slug}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1 hover:text-foreground transition-colors group"
									>
										<span className="group-hover:underline">
											{publicUrl}/animations/{animation.slug}
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
											<h1 className="text-3xl font-bold tracking-tight">{animation?.title || "Edit Animation"}</h1>
											{animation && (
												<button onClick={handleEditTitle} className="p-2 hover:bg-muted rounded-md transition-colors">
													<IconPencil className="h-5 w-5 text-muted-foreground" />
												</button>
											)}
										</div>
										{animation && (
											<a
												href={`${publicUrl}/animations/${animation.slug}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1 hover:text-foreground transition-colors group"
											>
												<span className="group-hover:underline">
													{publicUrl}/animations/{animation.slug}
												</span>
												<IconArrowUpRight className="h-3 w-3" />
											</a>
										)}
									</div>
									<Button variant="outline" onClick={() => router.push("/animations")} className="mt-4 sm:mt-0">
										<IconChevronLeft className="w-4 h-4" />
										Back to animations
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
							<p className="text-red-600">Error loading animation</p>
						</div>
					)}

					{animation && (
						<AnimationForm
							animation={animation}
							onClose={() => router.push("/animations")}
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
