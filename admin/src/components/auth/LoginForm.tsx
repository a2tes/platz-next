"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../stores/authStore";
import { LoginCredentials } from "../../types/auth";
import { Button } from "@/components/ui/button";
import { IconLoader2 } from "@tabler/icons-react";

// Validation schema
const loginSchema = z.object({
	email: z.string().min(1, "Email is required").email("Invalid email format"),
	password: z.string().min(1, "Password is required"),
	rememberMe: z.boolean().optional(),
});

type LoginFormData = {
	email: string;
	password: string;
	rememberMe?: boolean;
};

interface LoginFormProps {
	onSuccess?: () => void;
	className?: string;
}

export default function LoginForm({ onSuccess, className = "" }: LoginFormProps) {
	const [showPassword, setShowPassword] = useState(false);
	const { login, isLoading, error, clearError } = useAuth();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
			rememberMe: false,
		},
	});

	const onSubmit = async (data: LoginFormData) => {
		try {
			clearError();
			const credentials: LoginCredentials = {
				email: data.email,
				password: data.password,
				rememberMe: data.rememberMe || false,
			};
			await login(credentials);
			onSuccess?.();
		} catch (error) {
			// Error is already handled by the store
			console.error("Login failed:", error);
		}
	};

	return (
		<div className={`w-full max-w-md mx-auto ${className}`}>
			<div className="px-8 py-6">
				<div className="mb-6">
					<h2 className="text-2xl font-bold text-center">Sign In</h2>
					<p className="text-muted-foreground text-sm text-center mt-2">
						Enter your credentials to access the dashboard.
					</p>
				</div>

				{error && (
					<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
						<p className="text-red-800 text-sm">{error}</p>
					</div>
				)}

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					{/* Email Field */}
					<div>
						<label
							htmlFor="email"
							className={`block text-sm font-medium mb-1 ${errors.email ? "text-red-600" : "text-gray-700"}`}
						>
							{errors.email ? <>{errors.email.message}</> : <>Email Address</>}
						</label>
						<input
							{...register("email")}
							type="email"
							id="email"
							autoComplete="email"
							className={`w-full px-3 py-2 border rounded-md focus:outline-none ${
								errors.email ? "border-red-300" : "border-gray-300"
							}`}
							placeholder="Enter your email"
						/>
					</div>

					{/* Password Field */}
					<div>
						<label
							htmlFor="password"
							className={`block text-sm font-medium mb-1 ${errors.password ? "text-red-600" : "text-gray-700"}`}
						>
							{errors.password ? <>{errors.password.message}</> : <>Password</>}
						</label>
						<div className="relative">
							<input
								{...register("password")}
								type={showPassword ? "text" : "password"}
								id="password"
								autoComplete="current-password"
								className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none ${
									errors.password ? "border-red-300" : "border-gray-300"
								}`}
								placeholder="Enter your password"
							/>
							<button
								type="button"
								className="absolute inset-y-0 right-0 pr-3 flex items-center"
								onClick={() => setShowPassword(!showPassword)}
							>
								{showPassword ? (
									<EyeSlashIcon className="h-5 w-5 text-gray-400" />
								) : (
									<EyeIcon className="h-5 w-5 text-gray-400" />
								)}
							</button>
						</div>
					</div>

					{/* Remember Me */}
					<div className="flex items-center">
						<input
							{...register("rememberMe")}
							type="checkbox"
							id="rememberMe"
							className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
						/>
						<label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
							Remember me for 30 days
						</label>
					</div>

					{/* Submit Button */}
					<Button type="submit" variant={"outline"} disabled={isLoading} className="w-full">
						{isLoading ? (
							<div className="flex items-center">
								<IconLoader2 className="animate-spin mr-3 h-5 w-5" />
								Signing in...
							</div>
						) : (
							"Sign In"
						)}
					</Button>
				</form>

				{/* Additional Links */}
				<div className="mt-6 text-center">
					<p className="text-sm text-gray-600">Need help? Contact your webmaster.</p>
				</div>
			</div>
		</div>
	);
}
