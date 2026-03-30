"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { IconPlus, IconSearch, IconFileText, IconLoader2, IconAlertCircle } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AdminLayout } from "@/components/layout/admin-layout";
import { DataList, Column, Action } from "@/components/ui/data-list";

// Generic types
export interface BaseEntity {
	id: number;
	title: string;
	slug?: string;
	status?: "PUBLISHED" | "DRAFT" | "UNLISTED";
	createdAt: Date | string;
	updatedAt: Date | string;
	publishedAt?: Date | string | null;
	// Relaxed to accommodate different creator shapes across services
	creator?: {
		name?: string;
	} | null;
}

export interface PaginatedResponse<T> {
	data: T[];
	meta: {
		pagination: {
			page: number;
			limit: number;
			totalPages: number;
			totalItems: number;
		};
	};
}

export interface CountsResponse {
	all: number;
	mine: number;
	published: number;
	draft: number;
	unlisted?: number;
	trash: number;
}

export type FilterTab = "all" | "mine" | "published" | "draft" | "unlisted" | "trash";

// Navigation item interface
export interface NavigationItem {
	label: string;
	href: string;
	isActive?: boolean;
}

// Service interface that each entity service must implement
export interface EntityService<T extends BaseEntity> {
	getItems: (params: {
		search?: string;
		status?: "PUBLISHED" | "DRAFT" | "UNLISTED";
		page: number;
		limit: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		mine?: boolean;
	}) => Promise<PaginatedResponse<T>>;
	getTrashedItems: (params: {
		search?: string;
		page: number;
		limit: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}) => Promise<PaginatedResponse<T>>;
	getCounts: () => Promise<CountsResponse>;
	deleteItem: (id: number) => Promise<void>;
	purgeItem: (id: number) => Promise<void>;
	restoreItem: (id: number) => Promise<void>;
	updateItem?: (id: number, data: Partial<T>) => Promise<T>;
	publishItem?: (id: number) => Promise<T>;
	unpublishItem?: (id: number) => Promise<T>;
	// Optional bulk operations for performance; component will fallback to per-item if not provided
	bulkDeleteItems?: (ids: number[]) => Promise<void | {
		deletedIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}>;
	bulkPurgeItems?: (ids: number[]) => Promise<void | {
		purgedIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}>;
	bulkRestoreItems?: (ids: number[]) => Promise<void | {
		restoredIds: number[];
		skipped: Array<{ id: number; reason: string }>;
	}>;
	bulkPublish?: (ids: number[]) => Promise<{
		publishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}>;
	bulkUnpublish?: (ids: number[]) => Promise<{
		unpublishedIds: number[];
		failed: Array<{ id: number; title: string; error: string }>;
	}>;
}

// Config for the component
export interface EntityListConfig<T extends BaseEntity> {
	// Entity info
	entityName: string; // "work"
	entityNamePlural: string; // "works"
	entityDisplayName: string; // "Work"
	entityDisplayNamePlural: string; // "Works"
	entityDescription?: string; // Description text for the entity

	icon: React.ReactNode; // Icon for the entity

	// Query keys
	queryKey: string; // "works"
	countsQueryKey: string; // "works-counts"
	trashedQueryKey: string; // "trashed-works"

	// Service
	service: EntityService<T>;

	// DataList configuration - NEW!
	columns: Column<T>[];
	getActions?: (config: {
		filterTab: FilterTab;
		onEdit?: (item: T) => void;
		onTogglePublish: (item: T) => void;
		onDelete: (item: T) => void;
		onRestore?: (item: T) => void;
		onPurge?: (item: T) => void;
		// Singular item view base path (preferred), e.g. "/work", "/photographer"
		viewItemBasePath?: string;
		viewBasePath?: string;
	}) => Action<T>[];

	// Edit handling
	editMode: "modal" | "route";
	editRoute?: string; // e.g., "/works" (will append "/:id/edit")
	EditorModal?: React.ComponentType<{
		open: boolean;
		onOpenChange: (open: boolean) => void;
		item: T | null;
		onSaved: () => void;
	}>;

	// Optional: Custom empty state messages
	emptyStateMessages?: {
		all?: { title: string; description: string };
		mine?: { title: string; description: string };
		published?: { title: string; description: string };
		draft?: { title: string; description: string };
		unlisted?: { title: string; description: string };
		trash?: { title: string; description: string };
	};

	// Optional: Navigation menu
	navigation?: NavigationItem[];

	// Optional: View base path for public frontend
	// Singular item base path, e.g. "/work", "/photographer"
	viewItemBasePath?: string;
	viewBasePath?: string;

	// Optional: Actions shown next to the page title (e.g. SEO button)
	titleActions?: React.ReactNode;

	// Optional: Custom header actions (buttons shown next to Create button)
	headerActions?: React.ReactNode;
}

export function EntityListPage<T extends BaseEntity>({ config }: { config: EntityListConfig<T> }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedSearch, setDebouncedSearch] = React.useState("");
	const [filterTab, setFilterTab] = React.useState<FilterTab>("all");
	const [currentPage, setCurrentPage] = React.useState(1);
	const [deletingItem, setDeletingItem] = React.useState<T | null>(null);
	const [allItems, setAllItems] = React.useState<T[]>([]);
	const [hasMore, setHasMore] = React.useState(true);
	const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
	const [isBulkRunning, setIsBulkRunning] = React.useState(false);
	const [showEditor, setShowEditor] = React.useState(false);
	const [editingItem, setEditingItem] = React.useState<T | null>(null);
	const [deleteError, setDeleteError] = React.useState<string | null>(null);

	// Reset page when filter or search changes
	React.useEffect(() => {
		setCurrentPage(1);
		setAllItems([]);
		setHasMore(true);
		setSelectedIds(new Set());
	}, [debouncedSearch, filterTab]);

	// Debounce search
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Fetch items based on filter tab with pagination
	const {
		data: itemsData,
		isLoading,
		error,
		isFetching,
	} = useQuery({
		queryKey: [config.queryKey, debouncedSearch, filterTab, currentPage],
		queryFn: () => {
			const baseParams = {
				search: debouncedSearch || undefined,
				page: currentPage,
				limit: 25,
				sortBy: "updatedAt" as const,
				sortOrder: "desc" as const,
			};

			if (filterTab === "trash") {
				return config.service.getTrashedItems(baseParams);
			} else if (filterTab === "published") {
				return config.service.getItems({
					...baseParams,
					status: "PUBLISHED",
				});
			} else if (filterTab === "draft") {
				return config.service.getItems({
					...baseParams,
					status: "DRAFT",
				});
			} else if (filterTab === "unlisted") {
				return config.service.getItems({
					...baseParams,
					status: "UNLISTED",
				});
			} else if (filterTab === "mine") {
				return config.service.getItems({
					...baseParams,
					mine: true,
				});
			} else {
				return config.service.getItems(baseParams);
			}
		},
		staleTime: 1000 * 60 * 5,
		placeholderData: keepPreviousData,
		refetchOnWindowFocus: false,
	});

	// Fetch counts for tabs
	const { data: counts } = useQuery({
		queryKey: [config.countsQueryKey],
		queryFn: () => config.service.getCounts(),
		staleTime: 1000 * 60,
		refetchOnWindowFocus: false,
	});

	// Merge new data with existing data on page change
	React.useEffect(() => {
		if (itemsData) {
			if (currentPage === 1) {
				setAllItems(itemsData.data);
			} else {
				setAllItems((prev) => {
					const seen = new Set(prev.map((item) => item.id));
					const toAppend = itemsData.data.filter((item) => !seen.has(item.id));
					return [...prev, ...toAppend];
				});
			}
			const { page, totalPages } = itemsData.meta.pagination;
			setHasMore(page < totalPages);
		}
	}, [itemsData, currentPage]);

	// Infinite scroll
	React.useEffect(() => {
		let throttleTimer: NodeJS.Timeout | null = null;

		const handleScroll = () => {
			if (throttleTimer) return;

			throttleTimer = setTimeout(() => {
				const scrollPosition = window.innerHeight + window.scrollY;
				const pageHeight = document.documentElement.scrollHeight;

				if (scrollPosition >= pageHeight - 500 && hasMore && !isFetching && !isLoading) {
					setCurrentPage((prev) => prev + 1);
				}
				throttleTimer = null;
			}, 500);
		};

		window.addEventListener("scroll", handleScroll);
		return () => {
			window.removeEventListener("scroll", handleScroll);
			if (throttleTimer) clearTimeout(throttleTimer);
		};
	}, [hasMore, isFetching, isLoading]);

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: (id: number) => {
			if (filterTab === "trash") {
				return config.service.purgeItem(id);
			}
			return config.service.deleteItem(id);
		},
		onSuccess: () => {
			setCurrentPage(1);
			setAllItems([]);
			setHasMore(true);
			setSelectedIds(new Set());
			queryClient.invalidateQueries({ queryKey: [config.queryKey] });
			queryClient.invalidateQueries({ queryKey: [config.countsQueryKey] });
			queryClient.invalidateQueries({ queryKey: [config.trashedQueryKey] });
			setDeletingItem(null);
			setDeleteError(null);
			toast.success(
				filterTab === "trash"
					? `${config.entityDisplayName} permanently deleted`
					: `${config.entityDisplayName} moved to trash`,
			);
		},
		onError: (error: unknown) => {
			let message = `Failed to delete ${config.entityDisplayName.toLowerCase()}`;

			if (error && typeof error === "object") {
				const axiosError = error as Record<string, unknown>;
				const responseData = axiosError.response as Record<string, unknown> | undefined;
				if (responseData?.data) {
					const data = responseData.data as Record<string, unknown>;
					const backendError = data.error as Record<string, unknown> | undefined;
					if (backendError?.message) {
						message = String(backendError.message);
					} else if (data.message) {
						message = String(data.message);
					}
				} else if ((axiosError as { message?: string }).message) {
					message = String((axiosError as { message?: string }).message);
				}
			} else if (error instanceof Error) {
				message = error.message;
			}

			// Show error as toast and close modal
			toast.error(message);
			setDeletingItem(null);
			setDeleteError(null);
		},
	});

	// Toggle publish mutation
	const togglePublishMutation = useMutation({
		mutationFn: (item: T) => {
			if (item.status === "PUBLISHED") {
				return config.service.unpublishItem
					? config.service.unpublishItem(item.id)
					: config.service.updateItem!(item.id, {
							status: "DRAFT",
						} as Partial<T>);
			} else {
				return config.service.publishItem
					? config.service.publishItem(item.id)
					: config.service.updateItem!(item.id, {
							status: "PUBLISHED",
						} as Partial<T>);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [config.queryKey] });
			queryClient.invalidateQueries({ queryKey: [config.countsQueryKey] });
		},
	});

	// Restore mutation
	const restoreMutation = useMutation({
		mutationFn: (id: number) => config.service.restoreItem(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [config.queryKey] });
			queryClient.invalidateQueries({ queryKey: [config.countsQueryKey] });
			queryClient.invalidateQueries({ queryKey: [config.trashedQueryKey] });
		},
	});

	// Handlers
	const handleEdit = (item: T) => {
		if (config.editMode === "route" && config.editRoute) {
			router.push(`${config.editRoute}/${item.id}/edit`);
		} else if (config.editMode === "modal") {
			setEditingItem(item);
			setShowEditor(true);
		}
	};

	const handleDelete = (item: T) => {
		setDeletingItem(item);
	};

	const handleRestore = (item: T) => {
		restoreMutation.mutate(item.id);
	};

	const handleTogglePublish = (item: T) => {
		togglePublishMutation.mutate(item);
	};

	const handleNew = () => {
		if (config.editMode === "route" && config.editRoute) {
			router.push(`${config.editRoute}/new`);
		} else if (config.editMode === "modal") {
			setEditingItem(null);
			setShowEditor(true);
		}
	};

	// Selection helpers
	const toggleSelect = (id: number, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const toggleSelectAll = (ids: number[], checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) ids.forEach((id) => next.add(id));
			else ids.forEach((id) => next.delete(id));
			return next;
		});
	};

	// Bulk actions
	const runBulk = async (action: "publish" | "unpublish" | "delete" | "restore" | "purge") => {
		if (selectedIds.size === 0) return;
		setIsBulkRunning(true);
		try {
			const ids = Array.from(selectedIds);
			if (action === "delete" && config.service.bulkDeleteItems) {
				const result = await config.service.bulkDeleteItems(ids);

				// Handle result if returned
				if (result && typeof result === "object" && "deletedIds" in result) {
					const successCount = result.deletedIds.length;
					const skippedCount = result.skipped.length;

					if (successCount > 0) {
						toast.success(
							`Successfully deleted ${successCount} ${successCount === 1 ? config.entityName : config.entityNamePlural}`,
						);
					}

					if (skippedCount > 0) {
						if (skippedCount > 3) {
							toast.error(`Cannot delete ${skippedCount} ${config.entityNamePlural}`);
						} else {
							result.skipped.forEach((item) => {
								toast.error(`Cannot delete ${config.entityName} ${item.id}: ${item.reason}`);
							});
						}
					}
				} else {
					// Legacy response (void)
					toast.success(
						`Successfully deleted ${ids.length} ${ids.length === 1 ? config.entityName : config.entityNamePlural}`,
					);
				}
			} else if (action === "purge" && config.service.bulkPurgeItems) {
				const result = await config.service.bulkPurgeItems(ids);

				// Handle result if returned
				if (result && typeof result === "object" && "purgedIds" in result) {
					const successCount = result.purgedIds.length;
					const skippedCount = result.skipped.length;

					if (successCount > 0) {
						toast.success(
							`Successfully purged ${successCount} ${successCount === 1 ? config.entityName : config.entityNamePlural}`,
						);
					}

					if (skippedCount > 0) {
						result.skipped.forEach((item) => {
							toast.error(`Cannot purge ${config.entityName} ${item.id}: ${item.reason}`);
						});
					}
				} else {
					// Legacy response (void)
					toast.success(
						`Successfully purged ${ids.length} ${ids.length === 1 ? config.entityName : config.entityNamePlural}`,
					);
				}
			} else if (action === "restore" && config.service.bulkRestoreItems) {
				const result = await config.service.bulkRestoreItems(ids);

				// Handle result if returned
				if (result && typeof result === "object" && "restoredIds" in result) {
					const successCount = result.restoredIds.length;
					const skippedCount = result.skipped.length;

					if (successCount > 0) {
						toast.success(
							`Successfully restored ${successCount} ${
								successCount === 1 ? config.entityName : config.entityNamePlural
							}`,
						);
					}

					if (skippedCount > 0) {
						result.skipped.forEach((item) => {
							toast.error(`Cannot restore ${config.entityName} ${item.id}: ${item.reason}`);
						});
					}
				} else {
					// Legacy response (void)
					toast.success(
						`Successfully restored ${ids.length} ${ids.length === 1 ? config.entityName : config.entityNamePlural}`,
					);
				}
			} else if (action === "publish" && config.service.bulkPublish) {
				const result = await config.service.bulkPublish(ids);

				if (result?.failed?.length > 0) {
					result.failed.forEach((item: { id: number; title: string; error: string }) => {
						toast.error(`Could not publish ${item.title}: ${item.error}`);
					});
				}

				if (result?.publishedIds?.length > 0) {
					toast.success(
						`Successfully published ${result.publishedIds.length} ${
							result.publishedIds.length === 1 ? config.entityName : config.entityNamePlural
						}`,
					);
				}
			} else if (action === "unpublish" && config.service.bulkUnpublish) {
				const result = await config.service.bulkUnpublish(ids);

				if (result?.failed?.length > 0) {
					result.failed.forEach((item: { id: number; title: string; error: string }) => {
						toast.error(`Could not unpublish ${item.title}: ${item.error}`);
					});
				}

				if (result?.unpublishedIds?.length > 0) {
					toast.success(
						`Successfully unpublished ${result.unpublishedIds.length} ${
							result.unpublishedIds.length === 1 ? config.entityName : config.entityNamePlural
						}`,
					);
				}
			} else {
				// Fallback to per-item operations
				const results = await Promise.allSettled(
					ids.map((id) => {
						switch (action) {
							case "publish":
								return config.service.publishItem
									? config.service.publishItem(id)
									: config.service.updateItem!(id, {
											status: "PUBLISHED",
										} as Partial<T>);
							case "unpublish":
								return config.service.unpublishItem
									? config.service.unpublishItem(id)
									: config.service.updateItem!(id, {
											status: "DRAFT",
										} as Partial<T>);
							case "delete":
								return config.service.deleteItem(id);
							case "restore":
								return config.service.restoreItem(id);
							case "purge":
								return config.service.purgeItem(id);
							default:
								return Promise.resolve();
						}
					}),
				);

				// Check for failures and show specific error messages
				const failures = results.filter((r) => r.status === "rejected");
				if (failures.length > 0) {
					failures.forEach((failure) => {
						const error = (failure as PromiseRejectedResult).reason;
						let errorMessage = `Failed to ${action} item`;

						// Extract error message from backend response
						if (error?.response?.data?.error?.message) {
							errorMessage = error.response.data.error.message;
						} else if (error?.message) {
							errorMessage = error.message;
						}

						toast.error(errorMessage);
					});
				}

				// Only show success if there were successful operations
				const successes = results.filter((r) => r.status === "fulfilled");
				if (successes.length > 0) {
					toast.success(
						`Successfully ${action}ed ${successes.length} ${
							successes.length === 1 ? config.entityName : config.entityNamePlural
						}`,
					);
				}
			}

			queryClient.invalidateQueries({ queryKey: [config.queryKey] });
			queryClient.invalidateQueries({ queryKey: [config.countsQueryKey] });
			queryClient.invalidateQueries({ queryKey: [config.trashedQueryKey] });
			setSelectedIds(new Set());
		} catch (err) {
			console.error("Bulk action failed:", err);
			toast.error(`Failed to ${action} items`);
		} finally {
			setIsBulkRunning(false);
		}
	};

	// Check selected items status
	const getSelectedItemsStatus = () => {
		const selectedItems = allItems.filter((item) => selectedIds.has(item.id));
		const allPublished = selectedItems.every((item) => item.status === "PUBLISHED");
		const allDraft = selectedItems.every((item) => item.status === "DRAFT");
		return { allPublished, allDraft };
	};

	// Get empty state content
	const getEmptyStateContent = () => {
		const hasSearch = !!searchQuery;
		let title = "";
		let description = "";
		let showCreate = false;

		const customMessages = config.emptyStateMessages?.[filterTab];

		switch (filterTab) {
			case "all":
				title = hasSearch
					? `No ${config.entityNamePlural} match your search`
					: customMessages?.title || `No ${config.entityNamePlural} yet`;
				description = hasSearch
					? "Try adjusting your search terms"
					: customMessages?.description || `Create your first ${config.entityName} to get started`;
				showCreate = !hasSearch;
				break;
			case "mine":
				title = hasSearch
					? `No ${config.entityNamePlural} in Mine match your search`
					: customMessages?.title || `You haven't created any ${config.entityNamePlural} yet`;
				description = hasSearch
					? "Try different keywords or clear the search"
					: customMessages?.description || `Create a ${config.entityName} to see it here`;
				showCreate = !hasSearch;
				break;
			case "published":
				title = hasSearch
					? `No published ${config.entityNamePlural} match your search`
					: customMessages?.title || `No published ${config.entityNamePlural} yet`;
				description = hasSearch
					? "Try different keywords or clear the search"
					: customMessages?.description || `Publish a ${config.entityName} or create a new one`;
				showCreate = !hasSearch;
				break;
			case "draft":
				title = hasSearch ? "No drafts match your search" : customMessages?.title || "No drafts yet";
				description = hasSearch
					? "Try different keywords or clear the search"
					: customMessages?.description || `Create a draft to see it here`;
				showCreate = !hasSearch;
				break;
			case "trash":
				title = hasSearch
					? `No trashed ${config.entityNamePlural} match your search`
					: customMessages?.title || "Trash is empty";
				description = hasSearch
					? "Try different keywords or clear the search"
					: customMessages?.description || `No deleted ${config.entityNamePlural} to recover`;
				showCreate = false;
				break;
		}

		return { title, description, showCreate };
	};

	const emptyState = getEmptyStateContent();

	// Generate actions dynamically
	const actions = config.getActions
		? config.getActions({
				filterTab,
				onEdit: filterTab !== "trash" ? handleEdit : undefined,
				onTogglePublish: handleTogglePublish,
				onDelete: handleDelete,
				onRestore: filterTab === "trash" ? handleRestore : undefined,
				onPurge: filterTab === "trash" ? handleDelete : undefined,
				viewItemBasePath: config.viewItemBasePath,
				viewBasePath: config.viewBasePath,
			})
		: undefined;

	return (
		<AdminLayout>
			<div className="space-y-6">
				{/* Navigation Menu */}
				{config.navigation && config.navigation.length > 0 && (
					<div className="hidden sm:flex gap-4 sm:gap-6 border-b overflow-x-auto scrollbar-hide -mx-1 px-1">
						{config.navigation.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
									item.isActive
										? "border-primary text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground"
								}`}
							>
								{item.label}
							</Link>
						))}
					</div>
				)}

				{/* Header */}
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<h1 className="text-2xl sm:text-3xl font-bold truncate">{config.entityDisplayNamePlural}</h1>
						{config.entityDescription && (
							<div className="text-sm text-muted-foreground mt-1">{config.entityDescription}</div>
						)}
					</div>
					{config.titleActions}
				</div>

				{(!!counts?.all || !!counts?.trash) && (
					<>
						{/* Filters */}
						<div className="space-y-4">
							{/* Tabs */}
							{!isLoading && !selectedIds.size && (
								<div className="flex flex-col-reverse lg:flex-row gap-4 items-stretch lg:items-center justify-between">
									{/* Make tabs horizontally scrollable on mobile */}
									<div className="w-full overflow-x-auto lg:overflow-visible scrollbar-hide rounded-lg -mx-1 px-1">
										<Tabs
											value={filterTab}
											onValueChange={(v) => setFilterTab(v as FilterTab)}
											className="items-center lg:items-start"
										>
											<TabsList className="w-max whitespace-nowrap inline-flex h-9">
												<TabsTrigger value="all">
													All
													{typeof counts?.all === "number" ? ` (${counts.all})` : ""}
												</TabsTrigger>
												{counts?.all !== counts?.mine && !!counts?.mine && (
													<TabsTrigger value="mine">
														Mine
														{typeof counts?.mine === "number" ? ` (${counts.mine})` : ""}
													</TabsTrigger>
												)}
												{!!counts?.published && counts?.all !== counts?.published && (
													<TabsTrigger value="published">
														Published
														{typeof counts?.published === "number" ? ` (${counts.published})` : ""}
													</TabsTrigger>
												)}
												{!!counts?.draft && (
													<TabsTrigger value="draft">
														Draft
														{typeof counts?.draft === "number" ? ` (${counts.draft})` : ""}
													</TabsTrigger>
												)}
												{!!counts?.unlisted && (
													<TabsTrigger value="unlisted">
														Unlisted
														{typeof counts?.unlisted === "number" ? ` (${counts.unlisted})` : ""}
													</TabsTrigger>
												)}
												{!!counts?.trash && (
													<TabsTrigger value="trash">
														Trash
														{typeof counts?.trash === "number" ? ` (${counts.trash})` : ""}
													</TabsTrigger>
												)}
											</TabsList>
										</Tabs>
									</div>
									{/* Search */}
									<div className="flex items-center gap-2 sm:gap-4 w-full lg:w-auto lg:flex-none">
										<div className="relative flex-1 lg:flex-none lg:w-64">
											<IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
											<Input
												type="search"
												placeholder={`Search...`}
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="pl-9"
											/>
										</div>
										{config.headerActions}
										<Button onClick={handleNew} className="gap-2 shrink-0">
											<IconPlus className="h-4 w-4" />
											<span className="hidden sm:inline">Create</span>
										</Button>
									</div>
								</div>
							)}

							{/* Bulk action bar */}
							{selectedIds.size > 0 && (
								<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
									<div className="text-sm text-muted-foreground">{selectedIds.size} selected</div>
									<div className="flex flex-wrap gap-2 w-full sm:w-auto">
										{filterTab === "trash" ? (
											<>
												<Button
													size="sm"
													variant="outline"
													disabled={isBulkRunning}
													onClick={() => runBulk("restore")}
													className="flex-1 sm:flex-none"
												>
													Restore
												</Button>
												<Button
													size="sm"
													variant="destructive"
													disabled={isBulkRunning}
													onClick={() => runBulk("purge")}
													className="flex-1 sm:flex-none"
												>
													<span className="hidden sm:inline">Permanently </span>Delete
												</Button>
											</>
										) : (
											<>
												{(() => {
													const { allPublished, allDraft } = getSelectedItemsStatus();
													return (
														<>
															{!allPublished && (
																<Button
																	size="sm"
																	variant="outline"
																	disabled={isBulkRunning}
																	onClick={() => runBulk("publish")}
																	className="flex-1 sm:flex-none"
																>
																	Publish
																</Button>
															)}
															{!allDraft && (
																<Button
																	size="sm"
																	variant="outline"
																	disabled={isBulkRunning}
																	onClick={() => runBulk("unpublish")}
																	className="flex-1 sm:flex-none"
																>
																	Unpublish
																</Button>
															)}
														</>
													);
												})()}
												<Button
													size="sm"
													variant="destructive"
													disabled={isBulkRunning}
													onClick={() => runBulk("delete")}
													className="flex-1 sm:flex-none"
												>
													Delete
												</Button>
											</>
										)}
									</div>
								</div>
							)}
						</div>
					</>
				)}

				{/* Content Area */}
				{isLoading && currentPage === 1 ? (
					<div className="flex flex-col items-center justify-center py-20 px-4">
						<IconLoader2 className="h-10 w-10 text-muted-foreground animate-spin mb-3" />
						<p className="text-muted-foreground">Loading {config.entityNamePlural}...</p>
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center py-20 px-4">
						<div className="rounded-full bg-destructive/10 p-4 mb-4">
							<IconAlertCircle className="h-8 w-8 text-destructive" />
						</div>
						<p className="text-destructive font-medium">Failed to load {config.entityNamePlural}</p>
						<p className="text-sm text-muted-foreground mt-1">Please try again later</p>
					</div>
				) : allItems.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 px-4 text-center">
						<div className="rounded-full bg-muted p-4 mb-4">
							{config.icon ? config.icon : <IconFileText className="h-8 w-8 text-muted-foreground" />}
						</div>
						<h3 className="font-semibold text-foreground mb-1">{emptyState.title}</h3>
						<p className="text-sm text-muted-foreground mb-6">{emptyState.description}</p>
						{emptyState.showCreate && (
							<Button onClick={handleNew} variant="outline" className="gap-2">
								<IconPlus className="h-4 w-4" />
								Create {config.entityDisplayName}
							</Button>
						)}
					</div>
				) : (
					<>
						<DataList
							data={allItems}
							columns={config.columns}
							actions={actions}
							getItemId={(item) => item.id}
							getItemTitle={(item) => item.title}
							onTitleClick={filterTab !== "trash" ? handleEdit : undefined}
							selectedIds={selectedIds}
							onToggleSelect={toggleSelect}
							onToggleSelectAll={toggleSelectAll}
							emptyMessage={`No ${config.entityNamePlural} found`}
						/>

						{/* Infinite scroll indicator */}
						{hasMore && (
							<div className="flex justify-center py-12">
								<div className="flex flex-col items-center gap-2">
									<IconLoader2 className="h-6 w-6 text-muted-foreground animate-spin" />
									<p className="text-sm text-muted-foreground">Loading more...</p>
								</div>
							</div>
						)}

						{!hasMore && allItems.length > 0 && (
							<div className="flex justify-center py-8">
								<p className="text-sm text-muted-foreground">No more {config.entityNamePlural} to load</p>
							</div>
						)}
					</>
				)}

				{/* Delete Confirmation Dialog */}
				<AlertDialog
					open={!!deletingItem || !!deleteError}
					onOpenChange={(open) => {
						if (!open) {
							setDeletingItem(null);
							setDeleteError(null);
						}
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							{deleteError ? (
								<>
									<AlertDialogTitle className="text-destructive flex items-center gap-2">
										<IconAlertCircle className="h-5 w-5" />
										Cannot Delete
									</AlertDialogTitle>
									<AlertDialogDescription className="text-foreground">{deleteError}</AlertDialogDescription>
								</>
							) : (
								<>
									<AlertDialogTitle>
										{filterTab === "trash" ? "Permanently Delete?" : `Delete ${config.entityDisplayName}?`}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{filterTab === "trash" ? (
											<>
												You&apos;re about to permanently delete &ldquo;
												<span className="font-semibold">{deletingItem?.title}</span>
												&rdquo;. This action cannot be undone.
											</>
										) : (
											<>
												You&apos;re about to delete &ldquo;
												<span className="font-semibold">{deletingItem?.title}</span>
												&rdquo;. You can restore it later.
											</>
										)}
									</AlertDialogDescription>
								</>
							)}
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel onClick={() => setDeleteError(null)}>
								{deleteError ? "OK" : "Cancel"}
							</AlertDialogCancel>
							{!deleteError && (
								<AlertDialogAction
									onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
									className="bg-destructive text-white hover:bg-destructive/90"
									disabled={deleteMutation.isPending}
								>
									{deleteMutation.isPending ? (
										<>
											<IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
											{filterTab === "trash" ? "Deleting..." : "Moving..."}
										</>
									) : filterTab === "trash" ? (
										"Delete Permanently"
									) : (
										"Move to Trash"
									)}
								</AlertDialogAction>
							)}
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>

			{/* Modal Editor (if applicable) */}
			{config.editMode === "modal" && config.EditorModal && (
				<config.EditorModal
					open={showEditor}
					onOpenChange={(open) => setShowEditor(open)}
					item={editingItem}
					onSaved={() => {
						setCurrentPage(1);
						setAllItems([]);
						setHasMore(true);
						queryClient.invalidateQueries({ queryKey: [config.queryKey] });
						queryClient.invalidateQueries({
							queryKey: [config.countsQueryKey],
						});
					}}
				/>
			)}
		</AdminLayout>
	);
}
