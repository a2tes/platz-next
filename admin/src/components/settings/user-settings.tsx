"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconUser, IconKey } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/authStore";
import { useMediaLibraryStore } from "@/stores/mediaLibraryStore";
import { CropperModal } from "@/components/media/CropperModal";
import { MediaService, type MediaFile } from "@/services/mediaService";
import { UserService } from "@/services/userService";

const profileFormSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email address"),
});

const passwordFormSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
				"Password must contain at least one lowercase letter, one uppercase letter, and one number"
			),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export function UserSettings() {
	const { user } = useAuthStore();
	const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
	const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
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

	const passwordForm = useForm<PasswordFormValues>({
		resolver: zodResolver(passwordFormSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
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
			// Update auth store with updated user
			useAuthStore.setState({ user: updated });
			// Sync form with server values
			profileForm.reset({ name: updated.name, email: updated.email });
			toast.success("Profile updated successfully.");
		} catch (error) {
			console.error("Failed to update profile:", error);
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

	const onPasswordSubmit = async (data: PasswordFormValues) => {
		setIsUpdatingPassword(true);
		try {
			await UserService.changeMyPassword({
				currentPassword: data.currentPassword,
				newPassword: data.newPassword,
				confirmPassword: data.confirmPassword,
			});
			passwordForm.reset();
			toast.success("Password updated successfully.");
		} catch (error) {
			console.error("Failed to update password:", error);
			const err = error as {
				response?: { data?: { error?: { message?: string } } };
				message?: string;
			};
			const msg = err?.response?.data?.error?.message || err?.message || "Failed to change password";
			try {
				const parsed = JSON.parse(msg);
				if (Array.isArray(parsed) && parsed[0]?.message) {
					toast.error(parsed[0].message);
				} else if (typeof parsed === "object" && parsed?.message) {
					toast.error(parsed.message);
				} else {
					toast.error(msg);
				}
			} catch {
				toast.error(msg);
			}
		} finally {
			setIsUpdatingPassword(false);
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
			<Tabs defaultValue="profile" className="w-full">
				<div className="flex items-center justify-between">
					<TabsList>
						<TabsTrigger value="profile">
							<IconUser className="h-4 w-4" /> Profile
						</TabsTrigger>
						<TabsTrigger value="security">
							<IconKey className="h-4 w-4" /> Security
						</TabsTrigger>
					</TabsList>
				</div>

				{/* PROFILE TAB */}
				<TabsContent value="profile" className="mt-4">
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
								<CardTitle>Profile information</CardTitle>
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
										<div className="col-span-1 md:col-span-2 flex justify-end">
											<Button type="submit" disabled={isUpdatingProfile}>
												{isUpdatingProfile ? "Saving..." : "Save changes"}
											</Button>
										</div>
									</form>
								</Form>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* SECURITY TAB */}
				<TabsContent value="security" className="mt-4">
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Change password</CardTitle>
								<CardDescription>For your security, use a strong password.</CardDescription>
							</CardHeader>
							<CardContent>
								<Form {...passwordForm}>
									<form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
										<FormField
											control={passwordForm.control}
											name="currentPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Current password</FormLabel>
													<FormControl>
														<Input type="password" placeholder="Enter current password" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={passwordForm.control}
											name="newPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel>New password</FormLabel>
													<FormControl>
														<Input type="password" placeholder="Enter new password" {...field} />
													</FormControl>
													<FormDescription>At least 8 characters.</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={passwordForm.control}
											name="confirmPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Confirm new password</FormLabel>
													<FormControl>
														<Input type="password" placeholder="Confirm new password" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<div className="flex justify-end">
											<Button type="submit" disabled={isUpdatingPassword}>
												{isUpdatingPassword ? "Updating..." : "Change password"}
											</Button>
										</div>
									</form>
								</Form>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
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
