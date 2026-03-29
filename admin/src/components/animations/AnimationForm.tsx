"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconX, IconVideo, IconPlayerPlay, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import {
	AnimationsService,
	Animation,
	CreateAnimationData,
	UpdateAnimationData,
} from "../../services/animationsService";
import { MediaService, MediaFile } from "../../services/mediaService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AnimationRevisionsModal } from "./AnimationRevisionsModal";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";
import Image from "next/image";
import { getTimeAgo } from "@/lib/utils";

const animationSchema = z.object({
	title: z.string().min(1, "Title is required").max(191, "Title must be less than 191 characters"),
	shortDescription: z.string().optional(),
	client: z.string().max(191, "Client must be less than 191 characters").optional(),
	agency: z.string().max(191, "Agency must be less than 191 characters").optional(),
	tags: z.string(),
	videoFileId: z.number().nullable().optional(),
	metaDescription: z.string().optional(),
	metaKeywords: z.string().optional(),
	previewImageId: z.number().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED"]),
});

type AnimationFormData = z.infer<typeof animationSchema>;

interface AnimationFormProps {
	animation?: Animation | null;
	onClose: () => void;
	onSuccess: () => void;
}

type MediaSelectionType = "video" | "previewImage";

export const AnimationForm: React.FC<AnimationFormProps> = ({ animation, onClose, onSuccess }) => {
	const isEditing = !!animation;
	const queryClient = useQueryClient();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
		reset,
	} = useForm<AnimationFormData>({
		resolver: zodResolver(animationSchema),
		defaultValues: {
			title: animation?.title || "",
			shortDescription: animation?.shortDescription || "",
			client: animation?.client || "",
			agency: animation?.agency || "",
			tags: animation?.tags.join(", ") || "",
			status: animation?.status || "DRAFT",
			videoFileId: animation?.videoFileId,
			previewImageId: animation?.previewImageId,
			metaDescription: animation?.metaDescription || "",
			metaKeywords: animation?.metaKeywords || "",
		},
	});

	const watchedValues = watch();
	const [showRevisions, setShowRevisions] = React.useState(false);

	// Ref for croppable media field
	const previewRef = React.useRef<CroppableMediaFieldRef>(null);

	// Reset form when animation data changes (e.g., after revert)
	React.useEffect(() => {
		if (animation && isEditing) {
			reset({
				title: animation.title,
				shortDescription: animation.shortDescription || "",
				client: animation.client,
				agency: animation.agency || "",
				tags: animation.tags.join(", "),
				status: animation.status,
				videoFileId: animation.videoFileId,
				previewImageId: animation.previewImageId,
				metaDescription: animation.metaDescription || "",
				metaKeywords: animation.metaKeywords || "",
			});
		}
	}, [animation, isEditing, reset]);

	const { data: videoFile } = useQuery({
		queryKey: ["media-file", watchedValues.videoFileId],
		queryFn: () => MediaService.getFile(watchedValues.videoFileId!),
		enabled: !!watchedValues.videoFileId,
	});

	// Mutations
	const createMutation = useMutation({
		mutationFn: (data: CreateAnimationData) => AnimationsService.createAnimation(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["animations"] });
			toast.success("Animation created successfully");
			onSuccess();
		},
		onError: (error: unknown) => {
			let message = "Failed to create animation";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (data: UpdateAnimationData) => AnimationsService.updateAnimation(animation!.id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["animations"] });
			queryClient.invalidateQueries({ queryKey: ["animation", animation!.id] });
			toast.success("Animation updated successfully");
			onSuccess();
		},
		onError: (error: unknown) => {
			let message = "Failed to update animation";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		},
	});

	const onSubmit = async (data: AnimationFormData) => {
		try {
			const submitData = {
				...data,
				tags: data.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
			};

			let entityId: number;
			if (isEditing) {
				const updated = await updateMutation.mutateAsync(submitData as UpdateAnimationData);
				entityId = updated.id;
			} else {
				const created = await createMutation.mutateAsync(submitData as CreateAnimationData);
				entityId = created.id;
			}

			// Save any staged crops using the ref-based API
			await previewRef.current?.saveCrop(entityId);
		} catch (error: unknown) {
			let message = "Failed to save animation";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		}
	};

	const onError = () => {
		toast.error("Please check the form for errors.");
	};

	const handleMediaSelect = (type: MediaSelectionType) => {
		const { openSelectorModal } = useMediaLibraryStore.getState();
		if (type !== "video") return;
		openSelectorModal("video", (file: MediaFile) => {
			setValue("videoFileId", file.id);
		});
	};

	const handleRevertRevision = async (revisionId: number) => {
		try {
			if (!animation?.id) return;

			await AnimationsService.revertToRevision(animation.id, revisionId);

			await queryClient.invalidateQueries({ queryKey: ["animations"] });
			await queryClient.invalidateQueries({ queryKey: ["animation", animation.id] });

			toast.success("Reverted to selected version");
			setShowRevisions(false);
		} catch (error: unknown) {
			let message = "Failed to revert revision";
			if (error instanceof Error) {
				message = error.message;
			}
			toast.error(message);
		}
	};

	return (
		<>
			<form onSubmit={handleSubmit(onSubmit, onError)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
				{/* Left Column - Main Form Content */}
				<div className="lg:col-span-2 space-y-6">
					{/* Basic Information */}
					<div className="border rounded-xl mb-6">
						<h3 className="text-lg font-semibold border-b p-4">Basic Information</h3>
						<div className="space-y-6 p-4">
							{!isEditing && (
								<div>
									<Label htmlFor="title" className={errors.title ? "text-destructive" : ""}>
										{!errors.title ? "Title *" : errors.title.message}
									</Label>
									<Input id="title" className="mt-3" {...register("title")} placeholder="Enter animation title" />
								</div>
							)}

							<div>
								<Label htmlFor="shortDescription">Short Description</Label>
								<Textarea
									id="shortDescription"
									className="mt-3"
									{...register("shortDescription")}
									placeholder="Brief description of the animation"
									rows={3}
								/>
							</div>

							<div>
								<Label htmlFor="client" className={errors.client ? "text-destructive" : ""}>
									{!errors.client ? "Client" : errors.client.message}
								</Label>
								<Input id="client" className="mt-3" {...register("client")} placeholder="Enter client name" />
							</div>

							<div>
								<Label htmlFor="agency" className={errors.agency ? "text-destructive" : ""}>
									{!errors.agency ? "Agency" : errors.agency.message}
								</Label>
								<Input id="agency" className="mt-3" {...register("agency")} placeholder="Enter agency name" />
							</div>

							<div>
								<Label htmlFor="tags">Tags</Label>
								<Input id="tags" className="mt-3" {...register("tags")} placeholder="Enter tags separated by commas" />
							</div>
						</div>
					</div>

					{/* Media */}
					<div className="border rounded-xl">
						<h3 className="text-lg font-semibold border-b p-4 ">Media</h3>
						<div className="grid grid-cols-1 gap-4 p-4">
							{/* Video File */}
							<div>
								{videoFile ? (
									<div className="group relative">
										<div className="relative aspect-video overflow-hidden rounded-lg border">
											<Image
												src={videoFile.images.medium}
												alt={videoFile.originalName}
												fill
												className="object-cover"
												unoptimized
											/>
											{/* Play icon overlay */}
											<div className="absolute inset-0 flex items-center justify-center">
												<div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
													<IconPlayerPlay className="w-8 h-8 text-white fill-white" />
												</div>
											</div>
										</div>
										{/* Info bar */}
										<div className="absolute bottom-0 left-0 right-0 bg-linear-to-t rounded-b-lg from-black/50 to-transparent p-3 pt-6">
											<p className="text-white text-sm font-medium truncate">{videoFile.originalName}</p>
										</div>
										{/* Action buttons */}
										<div className="absolute top-2 right-2 flex gap-2">
											<Button
												size="sm"
												variant="secondary"
												className="h-8 w-8 p-0"
												onClick={() => handleMediaSelect("video")}
											>
												<IconRefresh className="h-4 w-4" />
											</Button>
											<Button
												size="sm"
												variant="destructive"
												className="h-8 w-8 p-0"
												onClick={() => setValue("videoFileId", null)}
											>
												<IconX className="h-4 w-4" />
											</Button>
										</div>
									</div>
								) : (
									<div
										className="aspect-video bg-muted rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 hover:border-muted-foreground/40 transition-colors"
										onClick={() => handleMediaSelect("video")}
									>
										<IconVideo className="h-10 w-10 text-muted-foreground mb-2" />
										<p className="text-sm font-medium text-muted-foreground">Select Video</p>
										<p className="text-xs text-muted-foreground/70 mt-1">Click to browse</p>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Right Column - Status & SEO */}
				<div className="lg:col-span-1 space-y-6 grid">
					{/* Status Card */}
					<div className="border rounded-xl mb-6 overflow-hidden order-2 lg:order-1">
						<div className="border-b p-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold">Status</h3>
							<div className="flex gap-4">
								<span className="text-sm font-medium">{watchedValues.status === "PUBLISHED" ? "Live" : "Draft"}</span>
								<button
									type="button"
									onClick={() => setValue("status", watchedValues.status === "DRAFT" ? "PUBLISHED" : "DRAFT")}
									className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
										watchedValues.status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300"
									}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
											watchedValues.status === "PUBLISHED" ? "translate-x-4.5" : "translate-x-0.5"
										}`}
									/>
								</button>
							</div>
						</div>
						{/* Revisions info */}
						{isEditing && (animation?.revisions?.filter((r) => r.version > 0).length || 0) > 0 && (
							<div className="border-b p-4 flex items-center justify-between bg-muted/30">
								<div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowRevisions(true)}>
									<span className="text-sm font-medium">Revisions</span>
									<span className="text-sm font-medium text-gray-500">
										({animation?.revisions?.filter((r) => r.version > 0).length || 0})
									</span>
								</div>
								<div className="flex items-center gap-3">
									<span className="text-xs text-muted-foreground">
										{isEditing && animation?.updatedAt
											? `last edited ${getTimeAgo(animation.updatedAt)}`
											: "new animation"}
									</span>
								</div>
							</div>
						)}
						<div className="p-4 space-y-4">
							<div className="space-y-2 flex gap-4">
								<Button type="button" variant="outline" className="flex-1" onClick={onClose}>
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
										? "Update Animation"
										: watchedValues.status === "PUBLISHED"
										? "Publish"
										: "Save as Draft"}
								</Button>
							</div>
						</div>
					</div>

					{/* SEO Card */}
					<div className="border rounded-xl mb-6 order-1 lg:order-2">
						<h3 className="text-lg font-semibold border-b p-4">SEO & Social Media</h3>
						<div className="p-4 space-y-4">
							{/* Preview Image */}
							<div>
								<CroppableMediaField
									ref={previewRef}
									label="Preview Image"
									value={watchedValues.previewImageId ?? null}
									onChange={(id) => setValue("previewImageId", id)}
									subjectType="Animation"
									subjectId={animation?.id}
									previousMediaId={animation?.previewImageId}
									usageKey="preview"
									aspect={2}
								/>
							</div>
							<div>
								<Label htmlFor="metaDescription">Meta Description</Label>
								<Textarea
									id="metaDescription"
									className="mt-3"
									{...register("metaDescription")}
									placeholder="Enter meta description"
									rows={3}
								/>
							</div>

							<div>
								<Label htmlFor="metaKeywords">Meta Keywords</Label>
								<Input
									id="metaKeywords"
									className="mt-3"
									{...register("metaKeywords")}
									placeholder="Enter keywords separated by commas"
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Revisions Modal */}
				<AnimationRevisionsModal
					open={showRevisions}
					onOpenChange={setShowRevisions}
					revisions={animation?.revisions || []}
					animation={animation || undefined}
					onRevert={handleRevertRevision}
					isLoading={false}
				/>
			</form>
		</>
	);
};
