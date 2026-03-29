"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserService } from "@/services/userService";

const passwordFormSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(8, "New password must be at least 8 characters"),
		confirmPassword: z.string().min(1, "Please confirm your new password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export function ChangePasswordSettings() {
	const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

	const passwordForm = useForm<PasswordFormValues>({
		resolver: zodResolver(passwordFormSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	const onPasswordSubmit = async (data: PasswordFormValues) => {
		setIsUpdatingPassword(true);
		try {
			await UserService.changeMyPassword({
				currentPassword: data.currentPassword,
				newPassword: data.newPassword,
				confirmPassword: data.confirmPassword,
			});
			toast.success("Password updated successfully.");
			passwordForm.reset();
		} catch (error) {
			const err = error as {
				response?: { data?: { error?: { message?: string } } };
				message?: string;
			};
			const msg = err?.response?.data?.error?.message || err?.message || "Failed to change password";
			toast.error(msg);
		} finally {
			setIsUpdatingPassword(false);
		}
	};

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Change Password</CardTitle>
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
									{isUpdatingPassword ? "Updating..." : "Change Password"}
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
