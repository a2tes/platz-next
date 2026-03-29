"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorksService, Director, CreateDirectorData, UpdateDirectorData } from "@/services/worksService";
import { MediaService, MediaFile } from "@/services/mediaService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaLibraryModal } from "@/components/media/MediaLibraryModal";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";
import Image from "next/image";
import {
	IconUserSquareRounded,
	IconX,
	IconPencil,
	IconCheck,
	IconArrowUpRight,
	IconPlus,
	IconTrash,
	IconLink,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const directorSchema = z.object({
	title: z.string().min(1, "Title is required").max(191),
	slug: z.string().optional(),
	shortDescription: z.string().nullable(),
	biography: z.string().nullable(),
	avatarId: z.number().nullable().optional(),
	ogImageId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED", "UNLISTED"]),
});

type DirectorFormData = z.infer<typeof directorSchema>;

export interface DirectorsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	director?: Director | null; // undefined/null => create mode
	onSaved?: (saved: Director | void) => void;
}

export function DirectorsModal({ open, onOpenChange, director, onSaved }: DirectorsModalProps) {
	const isEditing = !!director;
	const queryClient = useQueryClient();
	const ogImageRef = React.useRef<CroppableMediaFieldRef>(null);
	const publicUrl =
		`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}` ||
		`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

	const [isEditingTitle, setIsEditingTitle] = React.useState(!director);
	const [isEditingSlug, setIsEditingSlug] = React.useState(false);
	const [tempTitle, setTempTitle] = React.useState("");
	const [tempSlug, setTempSlug] = React.useState("");
	const [links, setLinks] = React.useState<Array<{ title: string; url: string }>>([]);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting, dirtyFields },
		setValue,
		getValues,
		watch,
		reset,
	} = useForm<DirectorFormData>({
		resolver: zodResolver(directorSchema),
		defaultValues: {
			title: director?.title || "",
			slug: director?.slug || "",
			shortDescription: director?.shortDescription || "",
			biography: director?.biography || "",
			avatarId: director?.avatar?.id ?? director?.avatarId ?? undefined,
			ogImageId: (director as any)?.ogImageId ?? undefined,
			metaDescription: (director as any)?.metaDescription || "",
			metaKeywords: (director as any)?.metaKeywords || "",
			status: director?.status || "DRAFT",
		},
	});

	const watchedValues = watch();

	React.useEffect(() => {
		if (open) {
			reset({
				title: director?.title || "",
				slug: director?.slug || "",
				shortDescription: director?.shortDescription || "",
				biography: director?.biography || "",
				avatarId: director?.avatar?.id ?? director?.avatarId ?? undefined,
				ogImageId: (director as any)?.ogImageId ?? undefined,
				metaDescription: (director as any)?.metaDescription || "",
				metaKeywords: (director as any)?.metaKeywords || "",
				status: director?.status || "DRAFT",
			});
			setIsEditingTitle(!director);
			setIsEditingSlug(false);
			setTempTitle(director?.title || "");
			setTempSlug(director?.slug || "");
			setLinks(director?.links ?? []);
		}
	}, [open, director, reset]);

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
		mutationFn: (data: CreateDirectorData) => WorksService.createDirector(data),
		onSuccess: (saved) => {
			toast.success("Director created");
			queryClient.invalidateQueries({ queryKey: ["directors"] });
			queryClient.invalidateQueries({ queryKey: ["directors-counts"] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to create director";
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: UpdateDirectorData) => WorksService.updateDirector(director!.id, data),
		onSuccess: (saved) => {
			toast.success("Director updated");
			queryClient.invalidateQueries({ queryKey: ["directors"] });
			queryClient.invalidateQueries({ queryKey: ["directors-counts"] });
			if (director) queryClient.invalidateQueries({ queryKey: ["director", director.id] });
			onSaved?.(saved);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to update director";
			toast.error(message);
		},
	});

	const onSubmit = async (data: DirectorFormData) => {
		// Filter out links with empty title and url
		const validLinks = links.filter((link) => link.title.trim() || link.url.trim());
		const payload = {
			title: data.title,
			slug: data.slug,
			shortDescription: data.shortDescription,
			biography: data.biography,
			avatarId: data.avatarId ?? undefined,
			ogImageId: data.ogImageId ?? null,
			links: validLinks.length > 0 ? validLinks : undefined,
			metaDescription: data.metaDescription || undefined,
			metaKeywords: data.metaKeywords || undefined,
			status: data.status,
		} as CreateDirectorData & UpdateDirectorData;

		if (isEditing) {
			await updateMutation.mutateAsync(payload);
			// Save OG image crop after update
			if (ogImageRef.current?.hasPendingChanges && director?.id) {
				await ogImageRef.current.saveCrop(director.id);
			}
		} else {
			const saved = await createMutation.mutateAsync(payload as CreateDirectorData);
			// Save OG image crop after create
			if (ogImageRef.current?.hasPendingChanges && saved?.id) {
				await ogImageRef.current.saveCrop(saved.id);
			}
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
						<DialogTitle>{isEditing ? "Edit Director" : "New Director"}</DialogTitle>
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
											placeholder="Director Name"
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
										{!director && !getValues("title") ? null : (
											<Button type="button" size="sm" variant="ghost" onClick={handleCancelTitle} className="shrink-0">
												<IconX className="h-4 w-4" />
											</Button>
										)}
									</div>
								) : (
									<div className="flex items-center gap-2 sm:gap-3">
										<h1 className="text-xl sm:text-3xl font-bold tracking-tight break-words">
											{watchedValues.title || "New Director"}
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
										<div className="flex items-center gap-2 mt-2">
											<Input
												value={tempSlug}
												onChange={(e) => setTempSlug(e.target.value)}
												className={`text-sm sm:text-3xl font-normal tracking-tight h-auto py-2 flex-1 min-w-0`}
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
									</div>
								) : (
									<div className="flex items-center gap-2 mt-1 group">
										<a
											href={`${publicUrl}/directors/${watchedValues.slug}`}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground transition-colors break-all"
										>
											<span className="group-hover:underline">
												{publicUrl}/directors/{watchedValues.slug}
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
									placeholder="You can write a short description about the director"
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
							placeholder="You can write a biography of the director"
							{...register("biography")}
						/>
					</div>

					{/* Links */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="flex items-center gap-1.5">
								<IconLink className="h-4 w-4" />
								Links
							</Label>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setLinks([...links, { title: "", url: "" }])}
								className="h-7 text-xs gap-1"
							>
								<IconPlus className="h-3.5 w-3.5" />
								Add Link
							</Button>
						</div>
						{links.length > 0 && (
							<div className="space-y-2">
								{links.map((link, index) => (
									<div key={index} className="flex items-start gap-2">
										<div className="flex-1 grid grid-cols-2 gap-2">
											<Input
												value={link.title}
												onChange={(e) => {
													const newLinks = [...links];
													newLinks[index] = { ...newLinks[index], title: e.target.value };
													setLinks(newLinks);
												}}
												placeholder="Link title"
												className="h-9 text-sm"
											/>
											<Input
												value={link.url}
												onChange={(e) => {
													const newLinks = [...links];
													newLinks[index] = { ...newLinks[index], url: e.target.value };
													setLinks(newLinks);
												}}
												placeholder="https://..."
												className="h-9 text-sm"
											/>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => setLinks(links.filter((_, i) => i !== index))}
											className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
										>
											<IconTrash className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						)}
					</div>

					{/* SEO & Social Media */}
					<div className="border rounded-xl">
						<h3 className="text-sm font-semibold border-b p-4">SEO & Social Media</h3>
						<div className="p-4 space-y-4">
							<div>
								<Label htmlFor="metaDescription">Meta Description</Label>
								<Textarea
									id="metaDescription"
									className="mt-1.5"
									{...register("metaDescription")}
									placeholder="Enter meta description for search engines"
									rows={3}
								/>
							</div>
							<div>
								<Label htmlFor="metaKeywords">Meta Keywords</Label>
								<Input
									id="metaKeywords"
									className="mt-1.5"
									{...register("metaKeywords")}
									placeholder="Enter keywords separated by commas"
								/>
							</div>
							<CroppableMediaField
								ref={ogImageRef}
								label="OG Image"
								value={watchedValues.ogImageId ?? null}
								onChange={(id) => setValue("ogImageId", id, { shouldDirty: true })}
								subjectType="Director"
								subjectId={director?.id}
								usageKey="ogImage"
								aspect={1200 / 630}
								previousMediaId={director?.ogImageId ?? null}
							/>
						</div>
					</div>

					<div className="flex flex-row items-center justify-between gap-4">
						{/* Status */}
						<div className="flex gap-2 items-center">
							<Select
								value={watchedValues.status}
								onValueChange={(value: "DRAFT" | "PUBLISHED" | "UNLISTED") => setValue("status", value)}
							>
								<SelectTrigger className="w-[140px]">
									<SelectValue placeholder="Select status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="DRAFT">Draft</SelectItem>
									<SelectItem value="PUBLISHED">Published</SelectItem>
									<SelectItem value="UNLISTED">Unlisted</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{/* Action Buttons */}
						<div className="flex justify-end gap-2 w-min md:w-full sm:w-auto">
							<Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
								Cancel
							</Button>
							<Button
								type="submit"
								variant={watchedValues.status === "PUBLISHED" ? "publish" : "default"}
								className="flex-1"
								disabled={isSubmitting}
							>
								{isSubmitting
									? "Saving..."
									: isEditing
										? "Save Changes"
										: watchedValues.status === "PUBLISHED"
											? "Publish"
											: "Save as Draft"}
							</Button>
						</div>
					</div>
				</form>

				{/* Media library modal lives here to support avatar selection */}
				<MediaLibraryModal />
			</DialogContent>
		</Dialog>
	);
}
