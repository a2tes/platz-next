"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { WorksService, Director, CreateDirectorData, UpdateDirectorData } from "@/services/worksService";
import { MediaService, MediaFile } from "@/services/mediaService";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaLibraryModal } from "@/components/media/MediaLibraryModal";
import { CroppableMediaField, CroppableMediaFieldRef } from "@/components/media/CroppableMediaField";
import { VideoSettingsModal } from "@/components/blocks/VideoSettingsModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Image from "next/image";
import {
	IconUserSquareRounded,
	IconPlus,
	IconTrash,
	IconLink,
	IconVideo,
	IconCrop,
	IconLoader2,
	IconMovie,
} from "@tabler/icons-react";
import { toast } from "sonner";
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

export interface DirectorFormProps {
	director?: Director | null;
	onClose: () => void;
	onSuccess?: (saved?: Director | void) => void;
}

export function DirectorForm({ director, onClose, onSuccess }: DirectorFormProps) {
	const isEditing = !!director;
	const queryClient = useQueryClient();
	const ogImageRef = React.useRef<CroppableMediaFieldRef>(null);

	const [links, setLinks] = React.useState<Array<{ title: string; url: string }>>(director?.links ?? []);

	// Hero work state
	const [heroWorkId, setHeroWorkId] = React.useState<number | null>(director?.heroWorkId ?? null);
	const [heroVideo, setHeroVideo] = React.useState<Director["heroVideo"]>(director?.heroVideo ?? null);
	const [isHeroVideoSettingsOpen, setIsHeroVideoSettingsOpen] = React.useState(false);
	const [heroMediaUrl, setHeroMediaUrl] = React.useState<string | null>(null);
	const [isWorkSelectorOpen, setIsWorkSelectorOpen] = React.useState(false);
	const [workSearchQuery, setWorkSearchQuery] = React.useState("");
	const [debouncedWorkSearchQuery, setDebouncedWorkSearchQuery] = React.useState("");

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		setValue,
		watch,
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
	const avatarId = watch("avatarId");

	const { data: avatarFile } = useQuery({
		queryKey: ["media-file", avatarId],
		queryFn: () => MediaService.getFile(avatarId!),
		enabled: !!avatarId,
	});

	const { data: heroMediaFile } = useQuery({
		queryKey: ["media-file", director?.heroMediaId],
		queryFn: () => MediaService.getFile(director?.heroMediaId!),
		enabled: !!heroWorkId && !!director?.heroMediaId,
	});

	// Debounce work search query
	React.useEffect(() => {
		const timer = setTimeout(() => setDebouncedWorkSearchQuery(workSearchQuery), 300);
		return () => clearTimeout(timer);
	}, [workSearchQuery]);

	// Fetch director works for selector with infinite scroll
	const {
		data: directorWorksData,
		fetchNextPage: fetchNextWorksPage,
		hasNextPage: hasNextWorksPage,
		isFetchingNextPage: isFetchingNextWorksPage,
		isLoading: isWorksLoading,
	} = useInfiniteQuery({
		queryKey: ["director-works", director?.id, "hero-selector", debouncedWorkSearchQuery],
		queryFn: ({ pageParam = 1 }) =>
			WorksService.getDirectorWorksPaginated(director!.id, {
				page: pageParam,
				limit: 10,
				...(debouncedWorkSearchQuery ? { search: debouncedWorkSearchQuery } : {}),
			}),
		getNextPageParam: (lastPage) => {
			const { page, totalPages } = lastPage.meta.pagination;
			return page < totalPages ? page + 1 : undefined;
		},
		initialPageParam: 1,
		enabled: isWorkSelectorOpen && !!director?.id,
	});

	// Flatten all pages into works list
	const allDirectorWorks = React.useMemo(() => {
		if (!directorWorksData?.pages) return [];
		return directorWorksData.pages.flatMap((page) => page.data);
	}, [directorWorksData]);

	// Get the selected hero work info from the director's works list
	const selectedHeroWork = React.useMemo(() => {
		if (!heroWorkId || !director?.works) return null;
		const found = director.works.find((wd: any) => wd.work?.id === heroWorkId);
		return found?.work || null;
	}, [heroWorkId, director?.works]);

	React.useEffect(() => {
		if (heroMediaFile?.video?.mp4 || heroMediaFile?.video?.hls) {
			setHeroMediaUrl(heroMediaFile.video.mp4 || heroMediaFile.video.hls || heroMediaFile.video.default || null);
		} else {
			setHeroMediaUrl(null);
		}
	}, [heroMediaFile]);

	// Poll for hero video processing status updates
	React.useEffect(() => {
		const status = heroVideo?.processedVideo?.status?.toLowerCase();
		if (!director?.id || (status !== "pending" && status !== "processing")) return;

		const interval = setInterval(async () => {
			try {
				const fresh = await WorksService.getDirector(director.id);
				if (fresh.heroVideo?.processedVideo) {
					const freshStatus = fresh.heroVideo.processedVideo.status?.toLowerCase();
					if (freshStatus === "completed" || freshStatus === "failed") {
						setHeroVideo(fresh.heroVideo);
						queryClient.invalidateQueries({ queryKey: ["director", director.id] });
					}
				}
			} catch {
				// ignore polling errors
			}
		}, 5000);

		return () => clearInterval(interval);
	}, [director?.id, heroVideo?.processedVideo?.status, queryClient]);

	const processHeroMutation = useMutation({
		mutationFn: (data: { cropSettings?: any; trimSettings?: any }) => WorksService.processHeroVideo(director!.id, data),
		onSuccess: (result) => {
			setHeroVideo((prev) => ({
				...(prev || {}),
				processedVideo: {
					status: result.status,
					clipJobId: result.jobId,
					settingsHash: result.settingsHash,
				},
			}));
			toast.success("Hero video processing started");
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to process hero video";
			toast.error(message);
		},
	});

	const createMutation = useMutation({
		mutationFn: (data: CreateDirectorData) => WorksService.createDirector(data),
		onSuccess: (saved) => {
			toast.success("Director created");
			queryClient.invalidateQueries({ queryKey: ["directors"] });
			queryClient.invalidateQueries({ queryKey: ["directors-counts"] });
			onSuccess?.(saved);
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
			onSuccess?.(saved);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to update director";
			toast.error(message);
		},
	});

	const onSubmit = async (data: DirectorFormData) => {
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
			if (ogImageRef.current?.hasPendingChanges && director?.id) {
				await ogImageRef.current.saveCrop(director.id);
			}
			if (director?.id && heroWorkId !== (director?.heroWorkId ?? null)) {
				if (heroWorkId) {
					await WorksService.setHeroVideo(director.id, { heroWorkId });
				} else {
					await WorksService.removeHeroVideo(director.id);
				}
			}
		} else {
			const saved = await createMutation.mutateAsync(payload as CreateDirectorData);
			if (ogImageRef.current?.hasPendingChanges && saved?.id) {
				await ogImageRef.current.saveCrop(saved.id);
			}
			if (saved?.id && heroWorkId) {
				await WorksService.setHeroVideo(saved.id, { heroWorkId });
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

	const chooseHeroWork = () => {
		setWorkSearchQuery("");
		setIsWorkSelectorOpen(true);
	};

	const handleWorkSelected = (work: any) => {
		setHeroWorkId(work.id);
		setHeroVideo(null);
		setIsWorkSelectorOpen(false);
		// Derive media URL from the work's video file
		if (work.videoFile) {
			const vf = work.videoFile;
			const url = vf.video?.mp4 || vf.video?.hls || vf.video?.default || null;
			setHeroMediaUrl(url);
		} else {
			setHeroMediaUrl(null);
		}
	};

	const clearHeroWork = () => {
		setHeroWorkId(null);
		setHeroVideo(null);
		setHeroMediaUrl(null);
		if (director?.id) {
			WorksService.removeHeroVideo(director.id).catch(() => {});
		}
	};

	const handleWorksScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const target = e.currentTarget;
		if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
			if (hasNextWorksPage && !isFetchingNextWorksPage) {
				fetchNextWorksPage();
			}
		}
	};

	const handleOpenHeroVideoSettings = () => {
		if (heroMediaUrl) {
			setIsHeroVideoSettingsOpen(true);
		}
	};

	const handleSaveHeroVideoSettings = (settings: { cropSettings?: any; trimSettings?: any }) => {
		setIsHeroVideoSettingsOpen(false);
		setHeroVideo((prev) => ({
			...(prev || {}),
			cropSettings: settings.cropSettings || null,
			trimSettings: settings.trimSettings || null,
		}));
	};

	const handleProcessHeroVideo = async () => {
		if (!director?.id || !heroWorkId) return;

		await WorksService.setHeroVideo(director.id, {
			heroWorkId,
			cropSettings: heroVideo?.cropSettings || undefined,
			trimSettings: heroVideo?.trimSettings || undefined,
		});

		if (heroVideo?.cropSettings || heroVideo?.trimSettings) {
			processHeroMutation.mutate({
				cropSettings: heroVideo?.cropSettings || undefined,
				trimSettings: heroVideo?.trimSettings || undefined,
			});
		}
	};

	return (
		<>
			<form onSubmit={handleSubmit(onSubmit, onError)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
				{/* Left Column - Main Content */}
				<div className="lg:col-span-2 space-y-6">
					{/* Basic Information */}
					<div className="border rounded-xl">
						<h3 className="text-lg font-semibold border-b p-4">Basic Information</h3>
						<div className="space-y-6 p-4">
							{/* Title (only on creation) */}
							{!isEditing && (
								<div>
									<Label htmlFor="title" className={errors.title ? "text-destructive" : ""}>
										{!errors.title ? "Title *" : errors.title.message}
									</Label>
									<Input id="title" className="mt-3" {...register("title")} placeholder="Enter director name" />
								</div>
							)}

							{/* Short Description */}
							<div>
								<Label htmlFor="shortDescription" className={errors.shortDescription ? "text-destructive" : ""}>
									{!errors.shortDescription ? "Short Description" : errors.shortDescription.message}
								</Label>
								<Textarea
									id="shortDescription"
									className="mt-3"
									rows={3}
									placeholder="You can write a short description about the director"
									{...register("shortDescription")}
								/>
							</div>

							{/* Biography */}
							<div>
								<Label htmlFor="biography" className={errors.biography ? "text-destructive" : ""}>
									{!errors.biography ? "Biography" : errors.biography.message}
								</Label>
								<Textarea
									id="biography"
									className="mt-3"
									rows={6}
									placeholder="You can write a biography of the director"
									{...register("biography")}
								/>
							</div>

							{/* Avatar */}
							<div>
								<Label htmlFor="avatar">Avatar</Label>
								<div className="border rounded-lg p-2 flex flex-row items-center gap-3 mt-3">
									<div
										className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center text-muted-foreground shrink-0"
										aria-label="Choose avatar"
										role="button"
									>
										{avatarFile ? (
											<Image
												src={avatarFile.images?.thumbnail || avatarFile.images?.original || ""}
												alt={avatarFile.originalName || "Avatar"}
												width={112}
												height={112}
												className="object-cover w-20 h-20"
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
											className="rounded-lg text-destructive hover:text-destructive cursor-pointer"
										>
											Remove
										</Button>
									) : (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={chooseAvatar}
											className="rounded-lg cursor-pointer"
										>
											Choose
										</Button>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Hero Work */}
					{isEditing && (
						<div className="border rounded-xl">
							<h3 className="text-lg font-semibold border-b p-4 flex items-center gap-1.5">
								<IconVideo className="h-4 w-4" />
								Hero Work
							</h3>
							<div className="p-4 space-y-3">
								{heroWorkId && (selectedHeroWork || heroMediaFile) ? (
									<div className="space-y-3">
										<div className="flex items-center gap-3">
											<div className="w-32 h-20 rounded bg-muted overflow-hidden flex items-center justify-center">
												{heroMediaFile?.images?.thumbnail ? (
													<Image
														src={heroMediaFile.images.thumbnail}
														alt="Hero work"
														width={128}
														height={80}
														className="object-cover w-full h-full"
														unoptimized
													/>
												) : (
													<IconMovie className="h-6 w-6 text-muted-foreground" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">{selectedHeroWork?.title || "Selected Work"}</p>
												{heroVideo?.processedVideo?.status && (
													<p
														className={`text-xs mt-1 ${
															heroVideo.processedVideo.status.toLowerCase() === "completed"
																? "text-green-600"
																: heroVideo.processedVideo.status.toLowerCase() === "failed"
																	? "text-destructive"
																	: "text-yellow-600"
														}`}
													>
														{heroVideo.processedVideo.status.toLowerCase() === "completed"
															? "Clip processed"
															: heroVideo.processedVideo.status.toLowerCase() === "failed"
																? `Processing failed: ${heroVideo.processedVideo.error || "Unknown error"}`
																: "Processing..."}
													</p>
												)}
												{heroVideo?.cropSettings && (
													<p className="text-xs text-muted-foreground mt-0.5">
														Crop: {Math.round(heroVideo.cropSettings.width)}% x{" "}
														{Math.round(heroVideo.cropSettings.height)}%
													</p>
												)}
												{heroVideo?.trimSettings && (
													<p className="text-xs text-muted-foreground">
														Trim: {heroVideo.trimSettings.startTime.toFixed(1)}s -{" "}
														{heroVideo.trimSettings.endTime.toFixed(1)}s
													</p>
												)}
											</div>
										</div>
										<div className="flex gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={handleOpenHeroVideoSettings}
												disabled={!heroMediaUrl}
												className="gap-1.5"
											>
												<IconCrop className="h-3.5 w-3.5" />
												Crop & Trim
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={handleProcessHeroVideo}
												disabled={
													processHeroMutation.isPending ||
													heroVideo?.processedVideo?.status?.toLowerCase() === "pending" ||
													heroVideo?.processedVideo?.status?.toLowerCase() === "processing" ||
													(!heroVideo?.cropSettings && !heroVideo?.trimSettings)
												}
												className="gap-1.5"
											>
												{processHeroMutation.isPending ||
												heroVideo?.processedVideo?.status?.toLowerCase() === "pending" ? (
													<IconLoader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<IconVideo className="h-3.5 w-3.5" />
												)}
												Process Clip
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={clearHeroWork}
												className="text-destructive hover:text-destructive"
											>
												Remove
											</Button>
										</div>
									</div>
								) : (
									<Button type="button" variant="outline" size="sm" onClick={chooseHeroWork} className="gap-1.5">
										<IconPlus className="h-3.5 w-3.5" />
										Choose Hero Work
									</Button>
								)}
							</div>
						</div>
					)}

					{/* Links */}
					<div className="border rounded-xl">
						<div className="flex items-center justify-between border-b p-4">
							<h3 className="text-lg font-semibold flex items-center gap-1.5">
								<IconLink className="h-4 w-4" />
								Links
							</h3>
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
							<div className="space-y-2 p-4">
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
				</div>

				{/* Right Column - Sidebar */}
				<div className="lg:col-span-1 space-y-6 grid">
					{/* Status */}
					<div className="border rounded-xl overflow-hidden order-2 lg:order-1">
						<div className="border-b p-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold">Status</h3>
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
						<div className="p-4 space-y-4">
							<div className="flex gap-4">
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
											? "Save Changes"
											: watchedValues.status === "PUBLISHED"
												? "Publish"
												: "Save as Draft"}
								</Button>
							</div>
						</div>
					</div>

					{/* SEO & Social Media */}
					<div className="border rounded-xl order-1 lg:order-2">
						<h3 className="text-lg font-semibold border-b p-4">SEO & Social Media</h3>
						<div className="p-4 space-y-4">
							<CroppableMediaField
								ref={ogImageRef}
								label="Preview Image"
								value={watchedValues.ogImageId ?? null}
								onChange={(id) => setValue("ogImageId", id, { shouldDirty: true })}
								subjectType="Director"
								subjectId={director?.id}
								usageKey="ogImage"
								aspect={1200 / 630}
								previousMediaId={director?.ogImageId ?? null}
							/>
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
						</div>
					</div>
				</div>
			</form>

			<MediaLibraryModal />

			{isHeroVideoSettingsOpen && heroMediaUrl && (
				<VideoSettingsModal
					mediaUrl={heroMediaUrl}
					cropSettings={heroVideo?.cropSettings || undefined}
					trimSettings={heroVideo?.trimSettings || undefined}
					mode="clip"
					onCancel={() => setIsHeroVideoSettingsOpen(false)}
					onSave={handleSaveHeroVideoSettings}
				/>
			)}

			{/* Work Selector Dialog */}
			<Dialog open={isWorkSelectorOpen} onOpenChange={setIsWorkSelectorOpen}>
				<DialogContent className="max-w-2xl flex flex-col">
					<DialogHeader>
						<DialogTitle>Select Hero Work</DialogTitle>
						<DialogDescription>Choose a work to feature in the hero section</DialogDescription>
					</DialogHeader>

					{/* Search */}
					<div className="mb-4">
						<Input
							placeholder="Search works..."
							value={workSearchQuery}
							onChange={(e) => setWorkSearchQuery(e.target.value)}
							className="flex-1"
						/>
					</div>

					{/* Works List */}
					<div className="h-[400px] border rounded-md overflow-y-auto" onScroll={handleWorksScroll}>
						<div className="p-2 space-y-1">
							{isWorksLoading ? (
								<div className="text-center text-muted-foreground py-8">Loading...</div>
							) : allDirectorWorks.length === 0 ? (
								<div className="text-center text-muted-foreground py-8">
									{workSearchQuery ? "No works found" : "No works available"}
								</div>
							) : (
								<>
									{allDirectorWorks.map((entity: any) => {
										const work = entity.work || entity;
										return (
											<button
												key={work.id}
												onClick={() => handleWorkSelected(work)}
												className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
											>
												{/* Thumbnail */}
												<div className="w-24 h-14 bg-muted rounded overflow-hidden shrink-0">
													{work.previewImage?.images?.thumbnail || work.videoFile?.images?.thumbnail ? (
														<img
															src={work.previewImage?.images?.thumbnail || work.videoFile?.images?.thumbnail}
															alt=""
															className="w-full h-full object-cover"
															loading="lazy"
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center">
															<IconMovie className="w-6 h-6 text-muted-foreground" />
														</div>
													)}
												</div>
												{/* Info */}
												<div className="flex-1 min-w-0">
													<div className="font-medium truncate">{work.title}</div>
													{work.slug && <div className="text-sm text-muted-foreground truncate">{work.slug}</div>}
												</div>
												{/* Video indicator */}
												{work.videoFile && <IconVideo className="w-4 h-4 text-muted-foreground shrink-0" />}
											</button>
										);
									})}
									{isFetchingNextWorksPage && (
										<div className="text-center text-muted-foreground py-4 text-sm">Loading more...</div>
									)}
								</>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
