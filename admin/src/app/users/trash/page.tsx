"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataList, Column, renderDateColumn } from "@/components/ui/data-list";
import { AdminUsersService, AdminUser } from "@/services/adminUsersService";
import Link from "next/link";
import { toast } from "sonner";

function capitalizeRole(role: AdminUser["role"]): string {
	const lower = role.toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function UsersTrashContent() {
	const queryClient = useQueryClient();
	const [search, setSearch] = React.useState("");

	const { data, isLoading } = useQuery({
		queryKey: ["admin-users-trash", search],
		queryFn: () =>
			AdminUsersService.getTrashedUsers({
				page: 1,
				limit: 50,
				search: search || undefined,
			}),
		staleTime: 1000 * 30,
	});

	const restoreMutation = useMutation({
		mutationFn: (id: number) => AdminUsersService.restoreUser(id),
		onSuccess: () => {
			toast.success("User restored");
			queryClient.invalidateQueries({ queryKey: ["admin-users-trash"] });
			queryClient.invalidateQueries({ queryKey: ["admin-users"] });
		},
		onError: (e: unknown) => {
			const err = e as {
				response?: { data?: { error?: { message?: string } } };
				message?: string;
			};
			const msg =
				err?.response?.data?.error?.message || err?.message || "Restore failed";
			toast.error(msg);
		},
	});

	const columns: Column<AdminUser>[] = [
		{
			key: "user",
			header: "User",
			render: (u) => (
				<div>
					<div className="font-medium">{u.name}</div>
					<div className="text-sm text-muted-foreground">{u.email}</div>
				</div>
			),
		},
		{
			key: "role",
			header: "Role",
			width: "w-40",
			render: (u) => (
				<Badge variant="secondary">{capitalizeRole(u.role)}</Badge>
			),
		},
		{
			key: "status",
			header: "Status",
			width: "w-36",
			render: (u) => (
				<span
					className={`px-2 py-1 rounded text-xs font-medium ${
						u.status === "PUBLISHED"
							? "bg-green-100 text-green-700"
							: "bg-gray-200 text-gray-700"
					}`}
				>
					{u.status === "PUBLISHED" ? "Active" : "Inactive"}
				</span>
			),
		},
		{
			key: "dates",
			header: "Dates",
			width: "w-64",
			render: (u) => (
				<div className="flex gap-6">
					{renderDateColumn("Created", u.createdAt)}
					{renderDateColumn("Updated", u.updatedAt)}
				</div>
			),
		},
	];

	const actions = [
		{
			label: "Restore",
			onClick: (u: AdminUser) => restoreMutation.mutate(u.id),
		},
	];

	return (
		<AdminLayout>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Users Trash</h1>
					<p className="text-muted-foreground">Restore deleted users.</p>
				</div>
				<div className="flex items-center gap-2">
					<Input
						placeholder="Search: name or email"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-64"
					/>
					<Button variant="outline" asChild>
						<Link href="/users">Back to Users</Link>
					</Button>
				</div>
			</div>

			<div>
				<DataList<AdminUser>
					data={data?.data || []}
					columns={columns}
					actions={actions}
					getItemId={(u) => u.id}
					getItemTitle={(u) => u.name}
					emptyMessage={isLoading ? "Loading..." : "No trashed users"}
				/>
			</div>
		</AdminLayout>
	);
}

export default function UsersTrashPage() {
	return (
		<ProtectedRoute requiredRole="ADMIN">
			<UsersTrashContent />
		</ProtectedRoute>
	);
}
