"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorksService, Starring, CreateStarringData, UpdateStarringData } from "@/services/worksService";
import { MediaService, MediaFile } from "@/services/mediaService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { IconUserSquareRounded, IconX, IconPencil, IconCheck, IconArrowUpRight } from "@tabler/icons-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

const starringSchema = z.object({
	title: z.string().min(1, "Title is required").max(191),
	slug: z.string().optional(),
	shortDescription: z.string().nullable(),
	biography: z.string().nullable(),
	avatarId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
});

type StarringFormData = z.infer<typeof starringSchema>;

export interface StarringsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	starring?: Starring | null; // undefined/null => create mode
	onSaved?: (saved: Starring | void) => void;
}

export function StarringsModal({ open, onOpenChange, starring, onSaved }: StarringsModalProps) {
	const isEditing = !!starring;
	const queryClient = useQueryClient();
	const publicUrl =
		`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}` ||
		`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

	const [isEditingTitle, setIsEditingTitle] = React.useState(!starring);
	const [isEditingSlug, setIsEditingSlug] = React.useState(false);
	const [tempTitle, setTempTitle] = React.useState("");
	const [tempSlug, setTempSlug] = React.useState("");

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting, dirtyFields },
		setValue,
		getValues,
		watch,
		reset,
	} = useForm<StarringFormData>({
		resolver: zodResolver(starringSchema),
		defaultValues: {
			title: starring?.title || "",
			slug: starring?.slug || "",
			shortDescription: starring?.shortDescription || "",
			biography: starring?.biography || "",
			avatarId: starring?.avatar?.id ?? starring?.avatarId ?? undefined,
			status: starring?.status || "DRAFT",
		},
	});

	const watchedValues = watch();

	React.useEffect(() => {
		if (open) {
			reset({
				title: starring?.title || "",
				slug: starring?.slug || "",
				shortDescription: starring?.shortDescription || "",
				biography: starring?.biography || "",
				avatarId: starring?.avatar?.id ?? starring?.avatarId ?? undefined,
				status: starring?.status || "DRAFT",
			});
			setIsEditingTitle(!starring);
			setIsEditingSlug(false);
			setTempTitle(starring?.title || "");
			setTempSlug(starring?.slug || "");
		}
	}, [open, starring, reset]);

	const handleEditTitle = () => {
		setTempTitle(getValues("title"));
		setIsEditingTitle(true);
	};

	const handleSaveTitle = () => {
		if (tempTitle.trim()) {
			const newTitle = tempTitle.trim();
			setValue("title", newTitle, {
				shouldValidate: true,
				shouldDirty: true,
			});
			setValue("slug", slugify(newTitle), {
				shouldValidate: true,
				shouldDirty: true,
			});
			setIsEditingTitle(false);
		}
	};

	const handleCancelTitle = () => {
		setIsEditingTitle(false);
		setTempTitle("");
	};

	const handleEditSlug = () => {
		setTempSlug(getValues("slug") || "");
		setIsEditingSlug(true);
	};

	const handleSaveSlug = () => {
		if (tempSlug.trim()) {
			setValue("slug", tempSlug.trim(), {
				shouldValidate: true,
				shouldDirty: true,
			});
			setIsEditingSlug(false);
		}
	};

	const handleCancelSlug = () => {
		setIsEditingSlug(false);
		setTempSlug("");
	};

	const avatarId = watch("avatarId");

	const { data: avatarFile } = useQuery({
		queryKey: ["media-file", avatarId],
		queryFn: () => MediaService.getFile(avatarId!),
		enabled: !!avatarId,
	});

	const createMutation = useMutation({
		mutationFn: (data: CreateStarringData) => WorksService.createStarring(data),
		onSuccess: (saved) => {
			toast.success("Starring created");
			queryClient.invalidateQueries({ queryKey: ["starrings"] });
			queryClient.invalidateQueries({ queryKey: ["starrings-counts"] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to create starring";
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: UpdateStarringData) => WorksService.updateStarring(starring!.id, data),
		onSuccess: (saved) => {
			toast.success("Starring updated");
			queryClient.invalidateQueries({ queryKey: ["starrings"] });
			queryClient.invalidateQueries({ queryKey: ["starrings-counts"] });
			if (starring) queryClient.invalidateQueries({ queryKey: ["starring", starring.id] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to update starring";
			toast.error(message);
		},
	});

	const onSubmit = async (data: StarringFormData) => {
		const payload = {
			title: data.title,
			slug: data.slug,
			shortDescription: data.shortDescription,
			biography: data.biography,
			avatarId: data.avatarId ?? undefined,
			status: data.status,
		} as CreateStarringData & UpdateStarringData;

		if (isEditing) {
			await updateMutation.mutateAsync(payload);
		} else {
			await createMutation.mutateAsync(payload as CreateStarringData);
		}
	};

	const onError = () => {
		toast.error("Please check the form");
	};

	const chooseAvatar = () => {
		const { openSelectorModal } = useMediaLibraryStore.getState();
		openSelectorModal("image", (file: MediaFile) => {
			setValue("avatarId", file.id);
		});
	};

	const clearAvatar = () => setValue("avatarId", undefined);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl p-0 w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<DialogTitle>{isEditing ? "Edit Starring" : "New Starring"}</DialogTitle>
						<div className="flex items-center space-x-4">
							{/* Close Button */}
							<Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
								<IconX className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6 p-4 sm:p-6">
					{/* Top: Avatar at left, Title + Short Description at right */}
					<div className="flex flex-col sm:flex-row gap-4 items-start">
						{/* Title and Short Description */}
						<div className="space-y-6 flex-1 w-full">
							<div className="flex flex-col gap-1">
								{/* Title Section */}
								{isEditingTitle ? (
									<div className="flex items-center gap-2 w-full">
										<Input
											value={tempTitle}
											onChange={(e) => setTempTitle(e.target.value)}
											className={`text-sm font-normal tracking-tight h-auto py-2 flex-1 min-w-0 ${
												errors.title ? "border-destructive" : ""
											}`}
											placeholder="Starring Name"
											autoFocus
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleSaveTitle();
												} else if (e.key === "Escape") {
													handleCancelTitle();
												}
											}}
										/>
										<Button type="button" size="sm" variant="ghost" onClick={handleSaveTitle} className="shrink-0">
											<IconCheck className="h-4 w-4" />
										</Button>
										{!starring && !getValues("title") ? null : (
											<Button type="button" size="sm" variant="ghost" onClick={handleCancelTitle} className="shrink-0">
												<IconX className="h-4 w-4" />
											</Button>
										)}
									</div>
								) : (
									<div className="flex items-center gap-2 sm:gap-3">
										<h1 className="text-xl sm:text-3xl font-bold tracking-tight break-words">
											{watchedValues.title || "New Starring"}
										</h1>
										<button
											type="button"
											onClick={handleEditTitle}
											className="p-2 hover:bg-muted rounded-md transition-colors"
										>
											<IconPencil className="h-5 w-5 text-muted-foreground" />
										</button>
									</div>
								)}

								{/* Slug Section */}
								{isEditingSlug ? (
									<div className="flex items-center gap-2 mt-2 w-full">
										<Input
											value={tempSlug}
											onChange={(e) => setTempSlug(e.target.value)}
											className={`text-sm font-normal tracking-tight h-auto py-2 flex-1 min-w-0`}
											placeholder="slug"
											autoFocus
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleSaveSlug();
												} else if (e.key === "Escape") {
													handleCancelSlug();
												}
											}}
										/>
										<Button type="button" size="sm" variant="ghost" onClick={handleSaveSlug} className="shrink-0">
											<IconCheck className="h-4 w-4" />
										</Button>
										<Button type="button" size="sm" variant="ghost" onClick={handleCancelSlug} className="shrink-0">
											<IconX className="h-4 w-4" />
										</Button>
									</div>
								) : (
									<div className="flex items-center gap-2 mt-1 group">
										<a
											href={`${publicUrl}/starrings/${watchedValues.slug}`}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground transition-colors break-all"
										>
											<span className="group-hover:underline">
												{publicUrl}/starrings/{watchedValues.slug}
											</span>
											<IconArrowUpRight className="h-3 w-3" />
										</a>
										<button
											type="button"
											onClick={handleEditSlug}
											className="p-1 hover:bg-muted rounded-md transition-colors opacity-0 group-hover:opacity-100"
										>
											<IconPencil className="h-3 w-3 text-muted-foreground" />
										</button>
									</div>
								)}
							</div>

							<div>
								<Label htmlFor="shortDescription" className={errors.shortDescription ? "text-destructive" : ""}>
									{!errors.shortDescription ? "Short Description" : errors.shortDescription.message}
								</Label>
								<Textarea
									id="shortDescription"
									className="mt-2"
									rows={3}
									placeholder="You can write a short description about the starring"
									{...register("shortDescription")}
								/>
							</div>
						</div>
						{/* Avatar Circle */}
						<div className="space-y-4 flex flex-col w-full sm:w-auto">
							<Label htmlFor="avatar">Avatar</Label>
							<div className="border rounded-lg p-2 flex flex-row sm:flex-col items-center gap-3 sm:gap-2">
								<div
									className="w-20 h-20 sm:w-26 sm:h-26 rounded-lg overflow-hidden bg-muted flex items-center justify-center text-muted-foreground shrink-0"
									aria-label="Choose avatar"
									role="button"
								>
									{avatarFile ? (
										<Image
											src={avatarFile.images?.thumbnail || avatarFile.images?.original || ""}
											alt={avatarFile.originalName || "Avatar"}
											width={112}
											height={112}
											className="object-cover w-20 h-20 sm:w-28 sm:h-28"
											unoptimized
										/>
									) : (
										<IconUserSquareRounded className="h-8 w-8" />
									)}
								</div>
								{avatarId ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={clearAvatar}
										className="rounded-lg text-destructive hover:text-destructive flex-1 cursor-pointer"
									>
										Remove
									</Button>
								) : (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={chooseAvatar}
										className="rounded-lg flex-1 cursor-pointer"
									>
										Choose
									</Button>
								)}
							</div>
						</div>
					</div>

					{/* Biography */}
					<div>
						<Label htmlFor="biography" className={errors.biography ? "text-destructive" : ""}>
							{!errors.biography ? "Biography" : errors.biography.message}
						</Label>
						<Textarea
							id="biography"
							className="mt-2"
							rows={6}
							placeholder="You can write a biography of the starring"
							{...register("biography")}
						/>
					</div>

					<div className="flex flex-row items-center justify-between gap-4">
						{/* Status */}
						<div className="flex gap-4 items-center">
							<button
								type="button"
								onClick={() => setValue("status", watchedValues.status === "DRAFT" ? "PUBLISHED" : "DRAFT")}
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
						{/* Action Buttons */}
						<div className="flex gap-2 justify-end">
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant={watchedValues.status === "PUBLISHED" ? "publish" : "default"}
								disabled={isSubmitting || !watchedValues.title?.trim()}
							>
								{isSubmitting
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
