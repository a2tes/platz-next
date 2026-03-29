"use client";

import * as React from "react";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import { AdminLayout } from "../../components/layout/admin-layout";
import { useAuth } from "../../stores/authStore";
import DashboardStats from "../../components/dashboard/DashboardStats";
import ActivityTabs from "../../components/dashboard/ActivityTabs";

export default function DashboardPage() {
	return (
		<ProtectedRoute>
			<DashboardContent />
		</ProtectedRoute>
	);
}

function DashboardContent() {
	const { user } = useAuth();

	return (
		<AdminLayout>
			<div className="space-y-8">
				{/* Page Header */}
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
					<p className="text-muted-foreground">Welcome back, {user?.name}!</p>
				</div>

				{/* Dashboard Statistics */}
				<DashboardStats />

				{/* Activity Feed */}
				<ActivityTabs />
			</div>
		</AdminLayout>
	);
}
