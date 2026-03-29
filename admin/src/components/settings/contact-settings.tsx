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

const contactSchema = z.object({
	contactEmail: z.string().email().or(z.literal("")).optional(),
	contactPhone: z.string().max(50).optional(),
	contactAddress: z.string().max(500).optional(),
	contactMapEmbed: z.string().max(2000).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactSettings() {
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
	} = useForm<ContactFormValues>({
		resolver: zodResolver(contactSchema),
		defaultValues: {
			contactEmail: "",
			contactPhone: "",
			contactAddress: "",
			contactMapEmbed: "",
		},
	});

	React.useEffect(() => {
		if (settings) {
			reset({
				contactEmail: settings.contactEmail || "",
				contactPhone: settings.contactPhone || "",
				contactAddress: settings.contactAddress || "",
				contactMapEmbed: settings.contactMapEmbed || "",
			});
		}
	}, [settings, reset]);

	const updateMutation = useMutation({
		mutationFn: (data: ContactFormValues) => SettingsService.update(data),
		onSuccess: () => {
			toast.success("Contact settings saved");
			queryClient.invalidateQueries({ queryKey: ["site-settings"] });
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to save settings";
			toast.error(message);
		},
	});

	const onSubmit = (data: ContactFormValues) => {
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
							rows={3}
							{...register("contactAddress")}
						/>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Map</CardTitle>
					<CardDescription>Google Maps or other map embed code</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Label htmlFor="contactMapEmbed">Map Embed Code</Label>
						<Textarea
							id="contactMapEmbed"
							className="mt-1.5 font-mono text-xs"
							placeholder='<iframe src="https://www.google.com/maps/embed?..." ...></iframe>'
							rows={4}
							{...register("contactMapEmbed")}
						/>
						<p className="text-xs text-muted-foreground mt-1">Paste the full iframe embed code from Google Maps.</p>
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
