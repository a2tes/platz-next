"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { DataList, Column, renderDateColumn } from "@/components/ui/data-list";
import { AdminUsersService, AdminUser } from "@/services/adminUsersService";
import { toast } from "sonner";
import { useAuth } from "@/stores/authStore";
import { IconPlus, IconX } from "@tabler/icons-react";

function capitalizeRole(role: AdminUser["role"]): string {
	const lower = role.toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function UsersPageContent() {
	const { user: currentUser } = useAuth();
	const queryClient = useQueryClient();
	const [search, setSearch] = React.useState("");
	const [filterTab, setFilterTab] = React.useState<"all" | "active" | "inactive" | "trash">("all");
	const [createOpen, setCreateOpen] = React.useState(false);
	const [editOpen, setEditOpen] = React.useState(false);
	const [deleting, setDeleting] = React.useState<AdminUser | null>(null);
	const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
	// Form error states for inline messages
	const [createFieldErrors, setCreateFieldErrors] = React.useState<Record<string, string>>({});
	const [createFormError, setCreateFormError] = React.useState<string | null>(null);
	const [editFieldErrors, setEditFieldErrors] = React.useState<Record<string, string>>({});
	const [editFormError, setEditFormError] = React.useState<string | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["admin-users", search, filterTab],
		queryFn: () => {
			if (filterTab === "trash") {
				return AdminUsersService.getTrashedUsers({
					page: 1,
					limit: 50,
					search: search || undefined,
				});
			}
			return AdminUsersService.getUsers({
				page: 1,
				limit: 50,
				search: search || undefined,
				status: filterTab === "active" ? "PUBLISHED" : filterTab === "inactive" ? "DRAFT" : undefined,
			});
		},
		staleTime: 1000 * 30,
	});

	// Counts for tabs
	const { data: counts } = useQuery({
		queryKey: ["admin-users-counts"],
		queryFn: () => AdminUsersService.getCounts(),
		staleTime: 1000 * 30,
	});

	// Compute active admins count for proactive UI guard
	const activeAdminsCount = React.useMemo(() => {
		const list = data?.data || [];
		return list.filter((u) => u.role === "ADMIN" && u.status === "PUBLISHED").length;
	}, [data]);

	const createMutation = useMutation({
		mutationFn: (payload: {
			name: string;
			email: string;
			password: string;
			role: AdminUser["role"];
			status?: AdminUser["status"];
		}) => AdminUsersService.createUser(payload),
		onSuccess: () => {
			toast.success("User created");
			setCreateOpen(false);
			setCreateFieldErrors({});
			setCreateFormError(null);
			queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			queryClient.invalidateQueries({ queryKey: ["admin-users-counts"] });
		},
		onError: (e: unknown) => {
			const err = e as {
				response?: {
					data?: {
						error?: { message?: string; code?: string; details?: unknown };
					};
				};
				message?: string;
			};
			const backendError = err?.response?.data?.error as
				| { message?: string; code?: string; details?: unknown }
				| undefined;
			const fieldErrors: Record<string, string> = {};
			let formError: string | null = null;
			if (backendError?.code === "VALIDATION_ERROR") {
				const details = backendError.details as Array<{ field?: string; message?: string }> | undefined;
				if (Array.isArray(details)) {
					for (const d of details) {
						if (d?.field && d?.message) {
							fieldErrors[d.field] = String(d.message);
						}
					}
				}
			} else if (backendError?.code === "DUPLICATE_ENTRY") {
				const fields = (backendError.details as { fields?: string[] } | undefined)?.fields;
				if (fields?.includes("email")) {
					fieldErrors.email = "Email is already in use";
				} else {
					formError = backendError.message || "Creation failed";
				}
			} else {
				formError = backendError?.message || err?.message || "Creation failed";
			}
			setCreateFieldErrors(fieldErrors);
			setCreateFormError(formError);
			toast.error(formError || Object.values(fieldErrors)[0] || "Creation failed");
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({
			id,
			payload,
		}: {
			id: number;
			payload: Partial<Pick<AdminUser, "name" | "email" | "role" | "status">>;
		}) => AdminUsersService.updateUser(id, payload),
		onSuccess: () => {
			toast.success("User updated");
			setEditOpen(false);
			setSelectedUser(null);
			setEditFieldErrors({});
			setEditFormError(null);
			queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			queryClient.invalidateQueries({ queryKey: ["admin-users-counts"] });
		},
		onError: (e: unknown) => {
			const err = e as {
				response?: {
					data?: {
						error?: { message?: string; code?: string; details?: unknown };
					};
				};
				message?: string;
			};
			const backendError = err?.response?.data?.error as
				| { message?: string; code?: string; details?: unknown }
				| undefined;
			const fieldErrors: Record<string, string> = {};
			let formError: string | null = null;
			if (backendError?.code === "VALIDATION_ERROR") {
				const details = backendError.details as Array<{ field?: string; message?: string }> | undefined;
				if (Array.isArray(details)) {
					for (const d of details) {
						if (d?.field && d?.message) {
							fieldErrors[d.field] = String(d.message);
						}
					}
				}
			} else if (backendError?.code === "DUPLICATE_ENTRY") {
				const fields = (backendError.details as { fields?: string[] } | undefined)?.fields;
				if (fields?.includes("email")) {
					fieldErrors.email = "Email is already in use";
				} else {
					formError = backendError.message || "Update failed";
				}
			} else {
				formError = backendError?.message || err?.message || "Update failed";
			}
			setEditFieldErrors(fieldErrors);
			setEditFormError(formError);
			toast.error(formError || Object.values(fieldErrors)[0] || "Update failed");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => AdminUsersService.deleteUser(id),
		onSuccess: () => {
			toast.success("User deleted");
			setDeleting(null);
			queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			queryClient.invalidateQueries({ queryKey: ["admin-users-counts"] });
		},
		onError: (e: unknown) => {
			const err = e as {
				response?: { data?: { error?: { message?: string } } };
				message?: string;
			};
			const msg = err?.response?.data?.error?.message || err?.message || "Delete failed";
			toast.error(msg);
		},
	});

	const statusMutation = useMutation({
		mutationFn: (user: AdminUser) =>
			AdminUsersService.setStatus(user.id, user.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			queryClient.invalidateQueries({ queryKey: ["admin-users-counts"] });
		},
		onError: (e: unknown) => {
			const err = e as {
				response?: { data?: { error?: { message?: string } } };
				message?: string;
			};
			const msg = err?.response?.data?.error?.message || err?.message || "Failed to update status";
			toast.error(msg);
		},
	});

	// Columns
	const columns: Column<AdminUser>[] = [
		{
			key: "user",
			header: "User",
			render: (u) => (
				<div>
					<div className="font-medium">{u.name}</div>
				</div>
			),
		},
		{
			key: "role",
			header: "Role",
			width: "w-40",
			render: (u) => <Badge variant="secondary">{capitalizeRole(u.role)}</Badge>,
		},
		{
			key: "status",
			header: "Status",
			width: "w-36",
			render: (u) => {
				if (filterTab === "trash") {
					return <Badge variant="secondary">Trashed</Badge>;
				}
				const isLastActiveAdmin = u.role === "ADMIN" && u.status === "PUBLISHED" && activeAdminsCount <= 1;
				const handleClick = () => {
					// Proactively block deactivating the last remaining admin (especially self)
					if (isLastActiveAdmin) {
						toast.error("Cannot deactivate the last remaining admin");
						return;
					}
					statusMutation.mutate(u);
				};
				return (
					<button
						onClick={handleClick}
						disabled={statusMutation.isPending}
						className={`px-2 py-1 rounded text-xs font-medium ${
							u.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
						} ${isLastActiveAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
					>
						{u.status === "PUBLISHED" ? "Active" : "Inactive"}
					</button>
				);
			},
		},
		{
			key: "dates",
			header: "Date",
			width: "w-48",
			render: (u) => <div className="flex gap-6">{renderDateColumn("Last Modified", u.updatedAt)}</div>,
		},
	];

	const restoreMutation = useMutation({
		mutationFn: (id: number) => AdminUsersService.restoreUser(id),
		onSuccess: () => {
			toast.success("User restored");
			queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			queryClient.invalidateQueries({ queryKey: ["admin-users-counts"] });
		},
		onError: (e: unknown) => {
			const err = e as {
				response?: { data?: { error?: { message?: string } } };
				message?: string;
			};
			const msg = err?.response?.data?.error?.message || err?.message || "Restore failed";
			toast.error(msg);
		},
	});

	const actions = React.useMemo(() => {
		if (filterTab === "trash") {
			return [
				{
					label: "Restore",
					onClick: (u: AdminUser) => restoreMutation.mutate(u.id),
				},
			];
		}
		return [
			{
				label: "Edit",
				onClick: (u: AdminUser) => {
					setSelectedUser(u);
					setEditOpen(true);
				},
			},
			{
				label: "Delete",
				onClick: (u: AdminUser) => setDeleting(u),
				className: "text-destructive hover:underline",
				show: (u: AdminUser) => u.id !== currentUser?.id,
			},
		];
	}, [filterTab, currentUser?.id, restoreMutation]);

	return (
		<AdminLayout>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">Users</h1>
				</div>

				{/* Filters and actions like EntityListPage */}
				<div className="space-y-4">
					<div className="flex flex-col-reverse lg:flex-row gap-4 items-center justify-between">
						{/* Tabs */}
						<div className="w-full overflow-x-auto lg:overflow-visible scrollbar-hide rounded-lg">
							<Tabs
								value={filterTab}
								onValueChange={(v) => setFilterTab(v as "all" | "active" | "inactive" | "trash")}
								className="items-center-safe lg:items-start"
							>
								<TabsList className="w-max whitespace-nowrap inline-flex">
									<TabsTrigger value="all">All{counts ? ` (${counts.all})` : ""}</TabsTrigger>
									<TabsTrigger value="active">Active{counts ? ` (${counts.active})` : ""}</TabsTrigger>
									<TabsTrigger value="inactive">Inactive{counts ? ` (${counts.inactive})` : ""}</TabsTrigger>
									<TabsTrigger value="trash">Trash{counts ? ` (${counts.trash})` : ""}</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>

						{/* Search + actions right aligned */}
						<div className="flex items-center justify-between gap-4 flex-1 lg:flex-none">
							<div className="relative max-w-full lg:max-w-md">
								<Input
									type="search"
									placeholder="Search users..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-3"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Button onClick={() => setCreateOpen(true)}>
									<IconPlus />
									Create
								</Button>
							</div>
						</div>
					</div>
				</div>

				<div>
					<DataList<AdminUser>
						data={data?.data || []}
						columns={columns}
						actions={actions}
						getItemId={(u) => u.id}
						getItemTitle={(u) => u.name}
						emptyMessage={isLoading ? "Loading..." : "No users found"}
					/>
				</div>

				{/* Create Dialog */}
				<CreateUserDialog
					open={createOpen}
					onOpenChange={(o) => {
						setCreateOpen(o);
						if (!o) {
							setCreateFieldErrors({});
							setCreateFormError(null);
						}
					}}
					onSubmit={(payload) => createMutation.mutate(payload)}
					loading={createMutation.isPending}
					fieldErrors={createFieldErrors}
					formError={createFormError}
				/>

				{/* Edit Dialog */}
				{selectedUser && (
					<EditUserDialog
						open={editOpen}
						onOpenChange={(o) => {
							setEditOpen(o);
							if (!o) {
								setSelectedUser(null);
								setEditFieldErrors({});
								setEditFormError(null);
							}
						}}
						user={selectedUser}
						onSubmit={(payload) => updateMutation.mutate({ id: selectedUser.id, payload })}
						loading={updateMutation.isPending}
						fieldErrors={editFieldErrors}
						formError={editFormError}
					/>
				)}

				{/* Delete Confirm */}
				<AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. The user will be moved to trash.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => deleting && deleteMutation.mutate(deleting.id)}
								className="bg-destructive"
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</AdminLayout>
	);
}

function CreateUserDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
	fieldErrors,
	formError,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: {
		name: string;
		email: string;
		password: string;
		role: AdminUser["role"];
		status?: AdminUser["status"];
	}) => void;
	loading?: boolean;
	fieldErrors?: Record<string, string>;
	formError?: string | null;
}) {
	const [name, setName] = React.useState("");
	const [email, setEmail] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [role, setRole] = React.useState<AdminUser["role"]>("EDITOR");
	const [status, setStatus] = React.useState<AdminUser["status"]>("PUBLISHED");
	const [localErrors, setLocalErrors] = React.useState<Record<string, string>>({});
	const errors = React.useMemo(() => ({ ...(fieldErrors || {}), ...(localErrors || {}) }), [fieldErrors, localErrors]);

	const reset = () => {
		setName("");
		setEmail("");
		setPassword("");
		setRole("EDITOR");
		setStatus("PUBLISHED");
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				onOpenChange(o);
				if (!o) reset();
			}}
		>
			<DialogContent className="sm:max-w-md p-0">
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<DialogTitle>New User</DialogTitle>
						<Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>
				<div className="space-y-4 p-6">
					<div>
						<label className="block text-sm mb-1">
							{errors?.name ? <span className="text-destructive">{errors.name}</span> : "Name"}
						</label>
						<Input value={name} onChange={(e) => setName(e.target.value)} />
					</div>
					<div>
						<label className="block text-sm mb-1">
							{errors?.email ? <span className="text-destructive">{errors.email}</span> : "Email"}
						</label>
						<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
					</div>
					<div>
						<label className="block text-sm mb-1">
							{errors?.password ? <span className="text-destructive">{errors.password}</span> : "Password"}
						</label>
						<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
					</div>
					<div>
						<label className="block text-sm mb-1">Role</label>
						<Select value={role} onValueChange={(v) => setRole(v as AdminUser["role"])}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select a role" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ADMIN">Admin</SelectItem>
								<SelectItem value="EDITOR">Editor</SelectItem>
								<SelectItem value="VIEWER">Viewer</SelectItem>
							</SelectContent>
						</Select>
						{formError && <div className="text-sm text-destructive mt-2">{formError}</div>}
					</div>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setStatus(status === "DRAFT" ? "PUBLISHED" : "DRAFT")}
								className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
									status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300"
								}`}
							>
								<span
									className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
										status === "PUBLISHED" ? "translate-x-4.5" : "translate-x-0.5"
									}`}
								/>
							</button>
							<span className="text-sm font-medium">{status === "PUBLISHED" ? "Active" : "Inactive"}</span>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button
								variant={status === "PUBLISHED" ? "publish" : "default"}
								onClick={() => {
									const errs: Record<string, string> = {};
									if (!name || name.trim().length < 4) {
										errs.name = "Name must be at least 4 characters";
									}
									if (!email) {
										errs.email = "Email is required";
									}
									if (!password) {
										errs.password = "Password is required";
									}
									setLocalErrors(errs);
									if (Object.keys(errs).length === 0) {
										onSubmit({ name, email, password, role, status });
									}
								}}
								disabled={loading}
							>
								{loading ? "Saving..." : status === "PUBLISHED" ? "Publish" : "Save as Draft"}
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function EditUserDialog({
	open,
	onOpenChange,
	user,
	onSubmit,
	loading,
	fieldErrors,
	formError,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: AdminUser;
	onSubmit: (
		payload: Partial<{
			name: string;
			email: string;
			role: AdminUser["role"];
			status: AdminUser["status"];
		}>,
	) => void;
	loading?: boolean;
	fieldErrors?: Record<string, string>;
	formError?: string | null;
}) {
	const [name, setName] = React.useState(user.name);
	const [email, setEmail] = React.useState(user.email);
	const [role, setRole] = React.useState<AdminUser["role"]>(user.role);
	const [status, setStatus] = React.useState<AdminUser["status"]>(user.status);
	const [localErrors, setLocalErrors] = React.useState<Record<string, string>>({});
	const errors = React.useMemo(() => ({ ...(fieldErrors || {}), ...(localErrors || {}) }), [fieldErrors, localErrors]);

	React.useEffect(() => {
		setName(user.name);
		setEmail(user.email);
		setRole(user.role);
		setStatus(user.status);
	}, [user]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md p-0">
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<DialogTitle>Edit User</DialogTitle>
						<Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
							<IconX className="h-4 w-4" />
						</Button>
					</div>
				</DialogHeader>
				<div className="space-y-4 p-6">
					<div>
						<label className="block text-sm mb-1">
							{errors?.name ? <span className="text-destructive">{errors.name}</span> : "Name"}
						</label>
						<Input value={name} onChange={(e) => setName(e.target.value)} />
					</div>
					<div>
						<label className="block text-sm mb-1">
							{errors?.email ? <span className="text-destructive">{errors.email}</span> : "Email"}
						</label>
						<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
					</div>
					<div>
						<label className="block text-sm mb-1">
							{errors?.role ? <span className="text-destructive">{errors.role}</span> : "Role"}
						</label>
						<Select value={role} onValueChange={(v) => setRole(v as AdminUser["role"])}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select a role" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ADMIN">Admin</SelectItem>
								<SelectItem value="EDITOR">Editor</SelectItem>
								<SelectItem value="VIEWER">Viewer</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{formError && <div className="text-sm text-destructive">{formError}</div>}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setStatus(status === "DRAFT" ? "PUBLISHED" : "DRAFT")}
								className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
									status === "PUBLISHED" ? "bg-green-600" : "bg-gray-300"
								}`}
							>
								<span
									className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
										status === "PUBLISHED" ? "translate-x-4.5" : "translate-x-0.5"
									}`}
								/>
							</button>
							<span className="text-sm font-medium">{status === "PUBLISHED" ? "Active" : "Inactive"}</span>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button
								variant={status === "PUBLISHED" ? "publish" : "default"}
								onClick={() => {
									const errs: Record<string, string> = {};
									if (!name || name.trim().length < 4) {
										errs.name = "Name must be at least 4 characters";
									}
									if (!email) {
										errs.email = "Email is required";
									}
									setLocalErrors(errs);
									if (Object.keys(errs).length === 0) {
										onSubmit({ name, email, role, status });
									}
								}}
								disabled={loading}
							>
								{loading ? "Saving..." : "Update"}
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default function UsersPage() {
	return (
		<ProtectedRoute requiredRole="ADMIN">
			<UsersPageContent />
		</ProtectedRoute>
	);
}
