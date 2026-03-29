"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconLoader2 } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsService } from "@/services/settingsService";

const generalSchema = z.object({
	siteName: z.string().max(191).optional(),
	siteDescription: z.string().max(500).optional(),
	siteTagline: z.string().max(191).optional(),
	googleAnalyticsId: z.string().max(50).optional(),
});

type GeneralFormValues = z.infer<typeof generalSchema>;

export function GeneralSettings() {
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
	} = useForm<GeneralFormValues>({
		resolver: zodResolver(generalSchema),
		defaultValues: {
			siteName: "",
			siteDescription: "",
			siteTagline: "",
			googleAnalyticsId: "",
		},
	});

	React.useEffect(() => {
		if (settings) {
			reset({
				siteName: settings.siteName || "",
				siteDescription: settings.siteDescription || "",
				siteTagline: settings.siteTagline || "",
				googleAnalyticsId: settings.googleAnalyticsId || "",
			});
		}
	}, [settings, reset]);

	const updateMutation = useMutation({
		mutationFn: (data: GeneralFormValues) => SettingsService.update(data),
		onSuccess: () => {
			toast.success("Settings saved");
			queryClient.invalidateQueries({ queryKey: ["site-settings"] });
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to save settings";
			toast.error(message);
		},
	});

	const onSubmit = (data: GeneralFormValues) => {
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
			<Card>
				<CardHeader>
					<CardTitle>General</CardTitle>
					<CardDescription>Basic site information and branding</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Label htmlFor="siteName">Site Name</Label>
						<Input id="siteName" className="mt-1.5" placeholder="Platz Agency" {...register("siteName")} />
						<p className="text-xs text-muted-foreground mt-1">
							The name of the site, shown in the browser tab and footer.
						</p>
					</div>
					<div>
						<Label htmlFor="siteTagline">Tagline</Label>
						<Input
							id="siteTagline"
							className="mt-1.5"
							placeholder="A production company"
							{...register("siteTagline")}
						/>
						<p className="text-xs text-muted-foreground mt-1">A short tagline or slogan for the site.</p>
					</div>
					<div>
						<Label htmlFor="siteDescription">Site Description</Label>
						<Textarea
							id="siteDescription"
							className="mt-1.5"
							placeholder="A short description of the site for search engines"
							rows={3}
							{...register("siteDescription")}
						/>
						<p className="text-xs text-muted-foreground mt-1">Used as the default meta description for SEO.</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Analytics</CardTitle>
					<CardDescription>Third-party analytics integration</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Label htmlFor="googleAnalyticsId">Google Analytics ID</Label>
						<Input
							id="googleAnalyticsId"
							className="mt-1.5"
							placeholder="G-XXXXXXXXXX"
							{...register("googleAnalyticsId")}
						/>
						<p className="text-xs text-muted-foreground mt-1">Your Google Analytics 4 measurement ID.</p>
					</div>
				</CardContent>
			</Card>

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
