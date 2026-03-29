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
import { IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

const taxonomySchema = z.object({
	name: z.string().min(1, "Name is required").max(191),
	slug: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
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
		},
	});

	const watchedValues = watch();

	React.useEffect(() => {
		if (open) {
			reset({
				name: taxonomy?.name || "",
				slug: taxonomy?.slug || "",
				status: taxonomy?.status || "PUBLISHED",
			});
		}
	}, [open, taxonomy, reset]);

	const createMutation = useMutation({
		mutationFn: (data: { name: string; status?: "DRAFT" | "PUBLISHED" }) => service.create(data),
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
		mutationFn: (data: { name?: string; slug?: string; status?: "DRAFT" | "PUBLISHED" }) =>
			service.update(taxonomy!.id, data),
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
		};

		if (isEditing) {
			await updateMutation.mutateAsync(payload);
		} else {
			await createMutation.mutateAsync(payload);
		}
	};

	const onError = () => {
		toast.error("Please check the form");
	};

	const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;
	const canSave = watchedValues.name?.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md p-0">
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<DialogTitle>{isEditing ? `Edit ${displayName}` : `New ${displayName}`}</DialogTitle>
						<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6 p-6">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input id="name" {...register("name")} placeholder={`${displayName} name`} autoFocus />
						{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
					</div>

					<div className="flex items-center justify-between">
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
