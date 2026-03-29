"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PhotographyService, PhotoCategory } from "@/services/photographyService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconX } from "@tabler/icons-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";
import { MediaLibraryModal } from "@/components/media/MediaLibraryModal";

const categorySchema = z.object({
	title: z.string().min(1, "Title is required").max(191),
	ogImageId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export interface PhotoCategoriesModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category?: PhotoCategory | null;
	onSaved?: () => void;
}

export function PhotoCategoriesModal({ open, onOpenChange, category, onSaved }: PhotoCategoriesModalProps) {
	const isEditing = !!category;
	const queryClient = useQueryClient();
	const ogImageRef = React.useRef<CroppableMediaFieldRef>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
		reset,
	} = useForm<CategoryFormData>({
		resolver: zodResolver(categorySchema),
		defaultValues: {
			title: category?.title || "",
			ogImageId: (category as any)?.ogImageId ?? undefined,
			metaDescription: category?.metaDescription || "",
			metaKeywords: category?.metaKeywords || "",
			status: category?.status || "DRAFT",
		},
	});

	React.useEffect(() => {
		if (open) {
			reset({
				title: category?.title || "",
				ogImageId: (category as any)?.ogImageId ?? undefined,
				metaDescription: category?.metaDescription || "",
				metaKeywords: category?.metaKeywords || "",
				status: category?.status || "DRAFT",
			});
		}
	}, [open, category, reset]);

	const status = watch("status");
	const watched = watch();

	const createMutation = useMutation({
		mutationFn: (data: CategoryFormData) => PhotographyService.createCategory(data),
		onSuccess: () => {
			toast.success("Category created");
			queryClient.invalidateQueries({ queryKey: ["photo-categories"] });
			queryClient.invalidateQueries({ queryKey: ["photo-categories-counts"] });
			onSaved?.();
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to create category";
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: CategoryFormData) => PhotographyService.updateCategory(category!.id, data),
		onSuccess: () => {
			toast.success("Category updated");
			queryClient.invalidateQueries({ queryKey: ["photo-categories"] });
			queryClient.invalidateQueries({ queryKey: ["photo-categories-counts"] });
			if (category)
				queryClient.invalidateQueries({
					queryKey: ["photo-category", category.id],
				});
			onSaved?.();
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to update category";
			toast.error(message);
		},
	});

	const onSubmit = async (data: CategoryFormData) => {
		let savedId: number | undefined;
		if (isEditing) {
			await updateMutation.mutateAsync(data);
			savedId = category?.id;
		} else {
			const saved = await createMutation.mutateAsync(data);
			savedId = (saved as any)?.id;
		}
		// Save OG image crop after entity save
		if (ogImageRef.current?.hasPendingChanges && savedId) {
			await ogImageRef.current.saveCrop(savedId);
		}
	};

	const onError = () => {
		toast.error("Please check the form");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg p-0 max-h-[85vh] flex flex-col overflow-hidden">
				<DialogHeader className="px-6 py-4 border-b shrink-0">
					<div className="flex items-center justify-between">
						<DialogTitle>{isEditing ? "Edit Category" : "New Category"}</DialogTitle>
						<Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4 p-6 overflow-y-auto min-h-0 flex-1">
					{/* Title */}
					<div>
						<Label htmlFor="title" className={errors.title ? "text-destructive" : ""}>
							{!errors.title ? "Title *" : errors.title.message}
						</Label>
						<Input id="title" className="mt-2" placeholder="Enter category title" {...register("title")} />
					</div>

					{/* SEO */}
					<div>
						<Label htmlFor="metaDescription">Meta Description</Label>
						<Textarea
							id="metaDescription"
							className="mt-2"
							rows={2}
							placeholder="Brief description for search engines"
							{...register("metaDescription")}
						/>
					</div>
					<div>
						<Label htmlFor="metaKeywords">Meta Keywords</Label>
						<Input
							id="metaKeywords"
							className="mt-2"
							placeholder="keyword1, keyword2, ..."
							{...register("metaKeywords")}
						/>
					</div>
					<CroppableMediaField
						ref={ogImageRef}
						label="OG Image"
						value={watched.ogImageId ?? null}
						onChange={(id) => setValue("ogImageId", id, { shouldDirty: true })}
						subjectType="PhotoCategory"
						subjectId={category?.id}
						usageKey="ogImage"
						aspect={1200 / 630}
						previousMediaId={(category as any)?.ogImageId ?? null}
					/>

					<div className="flex items-center justify-between">
						{/* Status Toggle */}
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setValue("status", watched.status === "DRAFT" ? "PUBLISHED" : "DRAFT")}
								className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
									watched.status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300"
								}`}
							>
								<span
									className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
										watched.status === "PUBLISHED" ? "translate-x-4.5" : "translate-x-0.5"
									}`}
								/>
							</button>
							<span className="text-sm font-medium">{watched.status === "PUBLISHED" ? "Live" : "Draft"}</span>
						</div>
						{/* Submit Buttons */}
						<div className="flex gap-2 justify-end">
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant={watched.status === "PUBLISHED" ? "publish" : "default"}
								disabled={isSubmitting || !watched.title?.trim()}
							>
								{isSubmitting
									? "Saving..."
									: isEditing
										? "Update"
										: watched.status === "PUBLISHED"
											? "Publish"
											: "Save as Draft"}
							</Button>
						</div>
					</div>
				</form>

				<MediaLibraryModal />
			</DialogContent>
		</Dialog>
	);
}
