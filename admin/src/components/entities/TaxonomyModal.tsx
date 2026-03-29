"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getTaxonomyService, Taxonomy, TaxonomyTypeSlug } from "@/services/taxonomyService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";

const taxonomySchema = z.object({
	name: z.string().min(1, "Name is required").max(191),
	slug: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
	ogImageId: z.number().nullable().optional(),
	metaDescription: z.string().max(500).optional(),
	metaKeywords: z.string().max(500).optional(),
});

type TaxonomyFormData = z.infer<typeof taxonomySchema>;

export interface TaxonomyModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	taxonomy?: Taxonomy | null;
	onSaved?: (saved: Taxonomy | void) => void;
	typeSlug: TaxonomyTypeSlug;
	displayName: string;
}

export function TaxonomyModal({ open, onOpenChange, taxonomy, onSaved, typeSlug, displayName }: TaxonomyModalProps) {
	const isEditing = !!taxonomy;
	const queryClient = useQueryClient();
	const service = getTaxonomyService(typeSlug);
	const croppableRef = React.useRef<CroppableMediaFieldRef>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
		reset,
	} = useForm<TaxonomyFormData>({
		resolver: zodResolver(taxonomySchema),
		defaultValues: {
			name: taxonomy?.name || "",
			slug: taxonomy?.slug || "",
			status: taxonomy?.status || "PUBLISHED",
			ogImageId: taxonomy?.ogImageId ?? null,
			metaDescription: taxonomy?.metaDescription || "",
			metaKeywords: taxonomy?.metaKeywords || "",
		},
	});

	const watchedValues = watch();

	React.useEffect(() => {
		if (open) {
			reset({
				name: taxonomy?.name || "",
				slug: taxonomy?.slug || "",
				status: taxonomy?.status || "PUBLISHED",
				ogImageId: taxonomy?.ogImageId ?? null,
				metaDescription: taxonomy?.metaDescription || "",
				metaKeywords: taxonomy?.metaKeywords || "",
			});
		}
	}, [open, taxonomy, reset]);

	const createMutation = useMutation({
		mutationFn: (data: {
			name: string;
			status?: "DRAFT" | "PUBLISHED";
			ogImageId?: number | null;
			metaDescription?: string | null;
			metaKeywords?: string | null;
		}) => service.create(data),
		onSuccess: (saved) => {
			toast.success(`${displayName} created`);
			queryClient.invalidateQueries({ queryKey: [`taxonomies-${typeSlug}`] });
			queryClient.invalidateQueries({ queryKey: [`taxonomies-${typeSlug}-counts`] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : `Failed to create ${displayName.toLowerCase()}`;
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: {
			name?: string;
			slug?: string;
			status?: "DRAFT" | "PUBLISHED";
			ogImageId?: number | null;
			metaDescription?: string | null;
			metaKeywords?: string | null;
		}) => service.update(taxonomy!.id, data),
		onSuccess: (saved) => {
			toast.success(`${displayName} updated`);
			queryClient.invalidateQueries({ queryKey: [`taxonomies-${typeSlug}`] });
			queryClient.invalidateQueries({ queryKey: [`taxonomies-${typeSlug}-counts`] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : `Failed to update ${displayName.toLowerCase()}`;
			toast.error(message);
		},
	});

	const onSubmit = async (data: TaxonomyFormData) => {
		const payload = {
			name: data.name,
			slug: data.slug || slugify(data.name),
			status: data.status,
			ogImageId: data.ogImageId ?? null,
			metaDescription: data.metaDescription || null,
			metaKeywords: data.metaKeywords || null,
		};

		if (isEditing) {
			const saved = await updateMutation.mutateAsync(payload);
			if (croppableRef.current?.hasPendingChanges && taxonomy?.id) {
				await croppableRef.current.saveCrop(taxonomy.id);
			}
		} else {
			const saved = await createMutation.mutateAsync(payload);
			if (croppableRef.current?.hasPendingChanges && saved?.id) {
				await croppableRef.current.saveCrop(saved.id);
			}
		}
	};

	const onError = () => {
		toast.error("Please check the form");
	};

	const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;
	const canSave = watchedValues.name?.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg p-0 max-h-[90vh] flex flex-col">
				<DialogHeader className="px-6 py-4 border-b shrink-0">
					<div className="flex items-center justify-between">
						<DialogTitle>{isEditing ? `Edit ${displayName}` : `New ${displayName}`}</DialogTitle>
						<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit, onError)} className="flex flex-col min-h-0 flex-1">
					<div className="space-y-6 p-6 overflow-y-auto">
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input id="name" {...register("name")} placeholder={`${displayName} name`} autoFocus />
							{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
						</div>

						<div className="space-y-2">
							<Label htmlFor="metaDescription">Meta Description</Label>
							<Textarea
								id="metaDescription"
								{...register("metaDescription")}
								placeholder="Enter meta description for search engines"
								rows={3}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="metaKeywords">Meta Keywords</Label>
							<Input id="metaKeywords" {...register("metaKeywords")} placeholder="keyword1, keyword2, keyword3" />
						</div>

						<CroppableMediaField
							ref={croppableRef}
							label="Preview Image"
							value={watchedValues.ogImageId ?? null}
							onChange={(id) => setValue("ogImageId", id)}
							subjectType="Taxonomy"
							subjectId={taxonomy?.id}
							usageKey="ogImage"
							aspect={1200 / 630}
							previousMediaId={taxonomy?.ogImageId ?? undefined}
						/>
					</div>

					<div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setValue("status", watchedValues.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}
								className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
									watchedValues.status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300"
								}`}
							>
								<span
									className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
										watchedValues.status === "PUBLISHED" ? "translate-x-4.5" : "translate-x-0.5"
									}`}
								/>
							</button>
							<span className="text-sm font-medium">{watchedValues.status === "PUBLISHED" ? "Live" : "Draft"}</span>
						</div>
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant={watchedValues.status === "PUBLISHED" ? "publish" : "default"}
								disabled={isPending || !canSave}
							>
								{isPending
									? "Saving..."
									: isEditing
										? "Update"
										: watchedValues.status === "PUBLISHED"
											? "Publish"
											: "Save as Draft"}
							</Button>
						</div>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
