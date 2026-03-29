"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { CropperModal } from "@/components/media/CropperModal";
import { MediaService, type MediaFile } from "@/services/mediaService";
import { UserService } from "@/services/userService";

const profileFormSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email address"),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ProfileSettings() {
	const { user } = useAuthStore();
	const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
	const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
	const [avatarMediaId, setAvatarMediaId] = React.useState<number | null>(null);
	const [cropperOpen, setCropperOpen] = React.useState(false);
	const [selectedFile, setSelectedFile] = React.useState<MediaFile | null>(null);

	const profileForm = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			name: user?.name || "",
			email: user?.email || "",
		},
	});

	// Load existing avatar crop preview on mount
	React.useEffect(() => {
		const load = async () => {
			if (!user) return;
			try {
				const crop = await MediaService.getCropBySubject({
					subjectType: "User",
					subjectId: user.id,
					usageKey: "avatar",
				});
				if (crop) {
					setAvatarMediaId(crop.mediaId);
					let previewUrl;
					if (crop.media?.uuid) {
						previewUrl = MediaService.buildImageUrl({
							uuid: crop.media.uuid,
							crop: { x: crop.x, y: crop.y, w: crop.w, h: crop.h },
							w: 160,
							h: 160,
							q: 82,
							format: "webp",
						});
					} else {
						previewUrl = MediaService.buildCroppedImageUrl({
							mediaId: crop.mediaId,
							subjectType: "User",
							subjectId: user.id,
							usageKey: "avatar",
							w: 160,
							h: 160,
							format: "webp",
							q: 82,
						});
					}
					setAvatarPreview(previewUrl);
				}
			} catch (err) {
				console.warn("No avatar crop found or failed to load:", err);
			}
		};
		load();
	}, [user]);

	const onProfileSubmit = async (data: ProfileFormValues) => {
		setIsUpdatingProfile(true);
		try {
			const updated = await UserService.updateMe({
				...data,
				avatarMediaId: avatarMediaId ?? null,
			});
			useAuthStore.setState({ user: updated });
			profileForm.reset({ name: updated.name, email: updated.email });
			toast.success("Profile updated successfully.");
		} catch (error) {
			const err = error as {
				response?: { data?: { error?: { message?: string } } };
				message?: string;
			};
			const msg = err?.response?.data?.error?.message || err?.message || "Failed to update profile";
			try {
				const parsed = JSON.parse(msg);
				if (Array.isArray(parsed) && parsed[0]?.message) {
					toast.error(parsed[0].message);
				} else {
					toast.error(msg);
				}
			} catch {
				toast.error(msg);
			}
		} finally {
			setIsUpdatingProfile(false);
		}
	};

	const openAvatarSelector = () => {
		const { openSelectorModal } = useMediaLibraryStore.getState();
		openSelectorModal("image", (file: MediaFile) => {
			setSelectedFile(file);
			setCropperOpen(true);
		});
	};

	const removeAvatar = () => {
		setAvatarPreview(null);
		setAvatarMediaId(null);
	};

	return (
		<>
			<div className="space-y-6">
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					{/* Avatar Card */}
					<Card className="lg:col-span-1">
						<CardHeader>
							<CardTitle>Avatar</CardTitle>
							<CardDescription>Pick an image from the Media Library.</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col items-center justify-center gap-4">
								<div className="h-20 w-20 overflow-hidden rounded-lg border bg-muted">
									{avatarPreview ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img src={avatarPreview} alt="Avatar preview" className="h-20 w-20 object-cover" />
									) : (
										<div className="flex h-20 w-20 items-center justify-center text-xl font-semibold">
											{(user?.name
												? user.name.split(" ")[0].slice(0, 1) +
													(user.name.split(" ")[1] ? user.name.split(" ")[1]?.slice(0, 1) : "")
												: "U"
											).toUpperCase()}
										</div>
									)}
								</div>
								<div className="flex flex-col items-center gap-2">
									<Button type="button" variant="secondary" onClick={openAvatarSelector}>
										Choose from library
									</Button>
									<Button type="button" variant="ghost" onClick={removeAvatar} disabled={!avatarPreview}>
										Remove
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Profile Form Card */}
					<Card className="lg:col-span-2">
						<CardHeader>
							<CardTitle>Profile Information</CardTitle>
							<CardDescription>Update your name and email.</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...profileForm}>
								<form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="flex flex-col gap-4">
									<FormField
										control={profileForm.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Name</FormLabel>
												<FormControl>
													<Input placeholder="Your name" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={profileForm.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<Input placeholder="your.email@example.com" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<div className="flex justify-end">
										<Button type="submit" disabled={isUpdatingProfile}>
											{isUpdatingProfile ? "Saving..." : "Save Changes"}
										</Button>
									</div>
								</form>
							</Form>
						</CardContent>
					</Card>
				</div>
			</div>
			{cropperOpen && selectedFile && (
				<CropperModal
					imageUrl={selectedFile!.images.original}
					aspect={1}
					title="Crop avatar"
					onCancel={() => {
						setCropperOpen(false);
						setSelectedFile(null);
					}}
					onSave={async (area) => {
						try {
							if (!user || !selectedFile) return;
							await MediaService.upsertCrop({
								mediaId: selectedFile!.id,
								subjectType: "User",
								subjectId: user.id,
								usageKey: "avatar",
								x: Math.round(area.x),
								y: Math.round(area.y),
								w: Math.round(area.width),
								h: Math.round(area.height),
							});
							setAvatarMediaId(selectedFile!.id);
							const previewUrl = MediaService.buildCroppedImageUrl({
								mediaId: selectedFile!.id,
								subjectType: "User",
								subjectId: user.id,
								usageKey: "avatar",
								w: 160,
								h: 160,
								format: "webp",
								q: 82,
							});
							setAvatarPreview(previewUrl);
						} finally {
							setCropperOpen(false);
							setSelectedFile(null);
						}
					}}
				/>
			)}
		</>
	);
}
