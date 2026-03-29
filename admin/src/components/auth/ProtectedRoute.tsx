"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useAuthStore } from "../../stores/authStore";
import { User } from "../../types/auth";
import { IconAlertSquareRounded } from "@tabler/icons-react";
import { Button } from "../ui/button";

interface ProtectedRouteProps {
	children: ReactNode;
	requiredRole?: "ADMIN" | "EDITOR" | "VIEWER";
	fallback?: ReactNode;
	redirectTo?: string;
}

export default function ProtectedRoute({
	children,
	requiredRole,
	fallback,
	redirectTo = "/login",
}: ProtectedRouteProps) {
	const { isAuthenticated, isLoading, user } = useAuth();
	const router = useRouter();

	useEffect(() => {
		// Initialize auth on component mount
		const initAuth = async () => {
			const store = useAuthStore.getState();
			if (typeof store.initializeAuth === "function") {
				await store.initializeAuth();
			}
		};
		initAuth();
	}, []);

	useEffect(() => {
		// Only redirect if we're sure authentication failed (not loading and not authenticated)
		if (!isLoading && !isAuthenticated) {
			router.push(redirectTo);
		}
	}, [isAuthenticated, isLoading, router, redirectTo]);

	// Show loading state
	if (isLoading) {
		return fallback || <LoadingSpinner />;
	}

	// Not authenticated
	if (!isAuthenticated || !user) {
		return fallback || <LoadingSpinner />;
	}

	// Check role requirements
	if (requiredRole && !hasRequiredRole(user, requiredRole)) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="max-w-md w-full bg-white rounded-lg p-6 text-center">
					<div className="mx-auto flex items-center justify-center h-12 w-12 rounded-2xl bg-red-100 mb-4">
						<IconAlertSquareRounded className="h-6 w-6 text-red-600" />
					</div>
					<h3 className="text-lg font-medium text-gray-900 mb-2">
						Access Denied
					</h3>
					<p className="text-gray-600 mb-4">
						You don&apos;t have permission to access this page.
					</p>
					<Button onClick={() => router.back()}>Go back</Button>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}

// Helper function to check role hierarchy
function hasRequiredRole(
	user: User,
	requiredRole: "ADMIN" | "EDITOR" | "VIEWER"
): boolean {
	const roleHierarchy = {
		ADMIN: 3,
		EDITOR: 2,
		VIEWER: 1,
	};

	const userRoleLevel = roleHierarchy[user.role];
	const requiredRoleLevel = roleHierarchy[requiredRole];

	return userRoleLevel >= requiredRoleLevel;
}

// Loading spinner component
function LoadingSpinner() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="flex flex-col items-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				<p className="mt-4 text-gray-600">Loading...</p>
			</div>
		</div>
	);
}

// Higher-order component for protecting pages
export function withAuth<P extends object>(
	Component: React.ComponentType<P>,
	options?: {
		requiredRole?: "ADMIN" | "EDITOR" | "VIEWER";
		redirectTo?: string;
	}
) {
	return function AuthenticatedComponent(props: P) {
		return (
			<ProtectedRoute
				requiredRole={options?.requiredRole}
				redirectTo={options?.redirectTo}
			>
				<Component {...props} />
			</ProtectedRoute>
		);
	};
}
