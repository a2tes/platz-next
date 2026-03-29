"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	IconBrandInstagram,
	IconBrandVimeo,
	IconBrandYoutube,
	IconBrandLinkedin,
	IconBrandX,
	IconBrandFacebook,
	IconBrandTiktok,
	IconLoader2,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsService, type SiteSettings as SiteSettingsType } from "@/services/settingsService";

const siteSettingsSchema = z.object({
	siteName: z.string().max(191).optional(),
	siteDescription: z.string().max(500).optional(),
	contactEmail: z.string().email().or(z.literal("")).optional(),
	contactPhone: z.string().max(50).optional(),
	contactAddress: z.string().max(500).optional(),
	socialMedia: z
		.object({
			instagram: z.string().max(500).optional(),
			vimeo: z.string().max(500).optional(),
			youtube: z.string().max(500).optional(),
			linkedin: z.string().max(500).optional(),
			x: z.string().max(500).optional(),
			facebook: z.string().max(500).optional(),
			tiktok: z.string().max(500).optional(),
		})
		.optional(),
});

type SiteSettingsFormValues = z.infer<typeof siteSettingsSchema>;

const socialFields = [
	{ key: "instagram" as const, label: "Instagram", icon: IconBrandInstagram, placeholder: "https://instagram.com/..." },
	{ key: "vimeo" as const, label: "Vimeo", icon: IconBrandVimeo, placeholder: "https://vimeo.com/..." },
	{ key: "youtube" as const, label: "YouTube", icon: IconBrandYoutube, placeholder: "https://youtube.com/..." },
	{ key: "linkedin" as const, label: "LinkedIn", icon: IconBrandLinkedin, placeholder: "https://linkedin.com/..." },
	{ key: "x" as const, label: "X (Twitter)", icon: IconBrandX, placeholder: "https://x.com/..." },
	{ key: "facebook" as const, label: "Facebook", icon: IconBrandFacebook, placeholder: "https://facebook.com/..." },
	{ key: "tiktok" as const, label: "TikTok", icon: IconBrandTiktok, placeholder: "https://tiktok.com/..." },
];

export function SiteSettings() {
	const queryClient = useQueryClient();

	const { data: settings, isLoading } = useQuery({
		queryKey: ["site-settings"],
		queryFn: () => SettingsService.getAll(),
	});

	const {
		register,
		handleSubmit,
		reset,
		formState: { isDirty, isSubmitting },
	} = useForm<SiteSettingsFormValues>({
		resolver: zodResolver(siteSettingsSchema),
		defaultValues: {
			siteName: "",
			siteDescription: "",
			contactEmail: "",
			contactPhone: "",
			contactAddress: "",
			socialMedia: {
				instagram: "",
				vimeo: "",
				youtube: "",
				linkedin: "",
				x: "",
				facebook: "",
				tiktok: "",
			},
		},
	});

	React.useEffect(() => {
		if (settings) {
			reset({
				siteName: settings.siteName || "",
				siteDescription: settings.siteDescription || "",
				contactEmail: settings.contactEmail || "",
				contactPhone: settings.contactPhone || "",
				contactAddress: settings.contactAddress || "",
				socialMedia: {
					instagram: settings.socialMedia?.instagram || "",
					vimeo: settings.socialMedia?.vimeo || "",
					youtube: settings.socialMedia?.youtube || "",
					linkedin: settings.socialMedia?.linkedin || "",
					x: settings.socialMedia?.x || "",
					facebook: settings.socialMedia?.facebook || "",
					tiktok: settings.socialMedia?.tiktok || "",
				},
			});
		}
	}, [settings, reset]);

	const updateMutation = useMutation({
		mutationFn: (data: SiteSettingsFormValues) => SettingsService.update(data),
		onSuccess: () => {
			toast.success("Settings saved");
			queryClient.invalidateQueries({ queryKey: ["site-settings"] });
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to save settings";
			toast.error(message);
		},
	});

	const onSubmit = (data: SiteSettingsFormValues) => {
		updateMutation.mutate(data);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			{/* General */}
			<Card>
				<CardHeader>
					<CardTitle>General</CardTitle>
					<CardDescription>Basic site information</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Label htmlFor="siteName">Site Name</Label>
						<Input id="siteName" className="mt-1.5" placeholder="Platz Agency" {...register("siteName")} />
					</div>
					<div>
						<Label htmlFor="siteDescription">Site Description</Label>
						<Textarea
							id="siteDescription"
							className="mt-1.5"
							placeholder="A short description of the site"
							rows={3}
							{...register("siteDescription")}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Contact Information */}
			<Card>
				<CardHeader>
					<CardTitle>Contact Information</CardTitle>
					<CardDescription>Contact details displayed on the site</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Label htmlFor="contactEmail">Email</Label>
						<Input
							id="contactEmail"
							type="email"
							className="mt-1.5"
							placeholder="info@example.com"
							{...register("contactEmail")}
						/>
					</div>
					<div>
						<Label htmlFor="contactPhone">Phone</Label>
						<Input id="contactPhone" className="mt-1.5" placeholder="+90 212 000 00 00" {...register("contactPhone")} />
					</div>
					<div>
						<Label htmlFor="contactAddress">Address</Label>
						<Textarea
							id="contactAddress"
							className="mt-1.5"
							placeholder="Istanbul, Turkey"
							rows={2}
							{...register("contactAddress")}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Social Media Links */}
			<Card>
				<CardHeader>
					<CardTitle>Social Media</CardTitle>
					<CardDescription>Social media profile links</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{socialFields.map((field) => {
						const Icon = field.icon;
						return (
							<div key={field.key} className="flex items-center gap-3">
								<Icon className="h-5 w-5 text-muted-foreground shrink-0" />
								<div className="flex-1">
									<Input placeholder={field.placeholder} {...register(`socialMedia.${field.key}`)} />
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>

			{/* Save Button */}
			<div className="flex justify-end">
				<Button type="submit" disabled={!isDirty || isSubmitting}>
					{isSubmitting ? (
						<>
							<IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
							Saving...
						</>
					) : (
						"Save Settings"
					)}
				</Button>
			</div>
		</form>
	);
}
