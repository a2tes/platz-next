"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	disciplinesService,
	Discipline,
	CreateDisciplineData,
	UpdateDisciplineData,
} from "@/services/disciplinesService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

const disciplineSchema = z.object({
	name: z.string().min(1, "Name is required").max(191),
	slug: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
});

type DisciplineFormData = z.infer<typeof disciplineSchema>;

export interface DisciplinesModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	discipline?: Discipline | null;
	onSaved?: (saved: Discipline | void) => void;
}

export function DisciplinesModal({ open, onOpenChange, discipline, onSaved }: DisciplinesModalProps) {
	const isEditing = !!discipline;
	const queryClient = useQueryClient();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
		reset,
	} = useForm<DisciplineFormData>({
		resolver: zodResolver(disciplineSchema),
		defaultValues: {
			name: discipline?.name || "",
			slug: discipline?.slug || "",
			status: discipline?.status || "PUBLISHED",
		},
	});

	const watchedValues = watch();

	React.useEffect(() => {
		if (open) {
			reset({
				name: discipline?.name || "",
				slug: discipline?.slug || "",
				status: discipline?.status || "PUBLISHED",
			});
		}
	}, [open, discipline, reset]);

	const createMutation = useMutation({
		mutationFn: (data: CreateDisciplineData) => disciplinesService.createDiscipline(data),
		onSuccess: (saved) => {
			toast.success("Discipline created");
			queryClient.invalidateQueries({ queryKey: ["disciplines"] });
			queryClient.invalidateQueries({ queryKey: ["disciplines-counts"] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to create discipline";
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: UpdateDisciplineData) => disciplinesService.updateDiscipline(discipline!.id, data),
		onSuccess: (saved) => {
			toast.success("Discipline updated");
			queryClient.invalidateQueries({ queryKey: ["disciplines"] });
			queryClient.invalidateQueries({ queryKey: ["disciplines-counts"] });
			if (discipline) queryClient.invalidateQueries({ queryKey: ["discipline", discipline.id] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to update discipline";
			toast.error(message);
		},
	});

	const onSubmit = async (data: DisciplineFormData) => {
		const payload = {
			name: data.name,
			slug: data.slug || slugify(data.name),
			status: data.status,
		} as CreateDisciplineData & UpdateDisciplineData;

		if (isEditing) {
			await updateMutation.mutateAsync(payload);
		} else {
			await createMutation.mutateAsync(payload as CreateDisciplineData);
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
						<DialogTitle>{isEditing ? "Edit Discipline" : "New Discipline"}</DialogTitle>
						<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6 p-6">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input id="name" {...register("name")} placeholder="Discipline name" autoFocus />
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
