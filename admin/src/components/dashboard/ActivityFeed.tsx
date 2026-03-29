"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { IconRefresh, IconInbox, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { DashboardService, Activity, ActivityFilters } from "../../services/dashboardService";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { formatDateTime } from "@/lib/utils";

interface ActivityFeedProps {
	type: "all" | "my";
	className?: string;
}

export default function ActivityFeed({ type, className = "" }: ActivityFeedProps) {
	const [activities, setActivities] = useState<Activity[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: 10,
		total: 0,
		totalPages: 0,
	});
	const [filters, setFilters] = useState<ActivityFilters>({
		page: 1,
		limit: 10,
	});

	const fetchActivities = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			const response =
				type === "all"
					? await DashboardService.getAllActivities(filters)
					: await DashboardService.getMyActivities(filters);

			setActivities(response.activities);
			setPagination(response.pagination);
		} catch (err) {
			console.error("Error fetching activities:", err);
			setError("Failed to load activities");
		} finally {
			setLoading(false);
		}
	}, [type, filters]);

	useEffect(() => {
		fetchActivities();
	}, [fetchActivities]);

	const handleFilterChange = (newFilters: Partial<ActivityFilters>) => {
		setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
	};

	const handlePageChange = (page: number) => {
		setFilters((prev) => ({ ...prev, page }));
	};

	const handleRefresh = () => {
		fetchActivities();
	};

	const formatDescription = (text: string) => {
		const parts = text.split(/(\*\*.*?\*\*)/g);
		return parts.map((part, index) => {
			if (part.startsWith("**") && part.endsWith("**")) {
				return (
					<span key={index} className="font-medium text-foreground">
						{part.slice(2, -2)}
					</span>
				);
			}
			return <span key={index}>{part}</span>;
		});
	};

	if (loading && activities.length === 0) {
		return (
			<div className={className}>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-9 w-20" />
					</div>
					{[...Array(6)].map((_, i) => (
						<div key={i} className="flex items-start gap-3">
							<Skeleton className="h-8 w-8 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-2/3" />
								<Skeleton className="h-3 w-1/2" />
							</div>
							<Skeleton className="h-5 w-20" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={className}>
				<div className="text-center space-y-3">
					<div className="mx-auto w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
						!
					</div>
					<p className="text-sm text-muted-foreground">{error}</p>
					<Button variant="outline" onClick={handleRefresh}>
						<IconRefresh className="mr-2 h-4 w-4" /> Try again
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={className}>
			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
				<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
					<Select
						value={filters.module ?? "all"}
						onValueChange={(v: string) => handleFilterChange({ module: v === "all" ? undefined : v })}
					>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="All modules" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Modules</SelectItem>
							<SelectItem value="works">Works</SelectItem>
							<SelectItem value="photography">Photography</SelectItem>
							<SelectItem value="media">Media Gallery</SelectItem>
							<SelectItem value="homepage">Homepage</SelectItem>
							<SelectItem value="content">Content Pages</SelectItem>
							<SelectItem value="users">Users</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={filters.action ?? "all"}
						onValueChange={(v: string) => handleFilterChange({ action: v === "all" ? undefined : v })}
					>
						<SelectTrigger className="w-full sm:w-40">
							<SelectValue placeholder="All actions" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Actions</SelectItem>
							<SelectItem value="create">Create</SelectItem>
							<SelectItem value="update">Update</SelectItem>
							<SelectItem value="delete">Delete</SelectItem>
							<SelectItem value="publish">Publish</SelectItem>
							<SelectItem value="unpublish">Unpublish</SelectItem>
							<SelectItem value="upload">Upload</SelectItem>
							<SelectItem value="move">Move</SelectItem>
							<SelectItem value="copy">Copy</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="w-full sm:w-auto">
					<IconRefresh className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</div>

			<Separator className="my-4" />

			{/* Activity List */}
			{activities.length === 0 ? (
				<div className="text-center py-10">
					<div className="mx-auto mb-3 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
						<IconInbox className="h-6 w-6 text-muted-foreground" />
					</div>
					<p className="text-sm text-muted-foreground">No activities found</p>
				</div>
			) : (
				<div className="space-y-2">
					{activities.map((activity) => (
						<div key={activity.id} className="group flex items-start gap-3 rounded-lg p-3 bg-muted/50">
							<div
								className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${DashboardService.getActivityColor(
									activity.action
								)}`}
							>
								{DashboardService.getActivityIcon(activity.action)}
							</div>
							<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center flex-1 gap-1 sm:gap-2 min-w-0">
								<div className="min-w-0">
									<p className="text-sm font-base break-words">{formatDescription(activity.description)}</p>
									<span className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-1 sm:gap-3">
										<span>{DashboardService.formatModuleName(activity.module)}</span>
										{activity.user && (
											<>
												<span className="hidden sm:inline">·</span>
												<span>{activity.user.name}</span>
											</>
										)}
										<span className="sm:hidden">·</span>
										<span className="sm:hidden">{DashboardService.getRelativeTime(activity.createdAt)}</span>
									</span>
								</div>
								<div className="hidden sm:block text-xs text-muted-foreground shrink-0">
									<Tooltip>
										<TooltipTrigger>{DashboardService.getRelativeTime(activity.createdAt)}</TooltipTrigger>
										<TooltipContent side="bottom" align="center" className="px-2 py-1 text-xs">
											{formatDateTime(activity.createdAt)}
										</TooltipContent>
									</Tooltip>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Pagination */}
			{pagination.totalPages > 1 && (
				<div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4 text-sm">
					<div className="text-muted-foreground text-center sm:text-left">
						Showing {(pagination.page - 1) * pagination.limit + 1}–
						{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => handlePageChange(pagination.page - 1)}
							disabled={pagination.page <= 1}
						>
							<IconChevronLeft className="h-4 w-4 sm:mr-1" />
							<span className="hidden sm:inline">Prev</span>
						</Button>
						<span className="text-muted-foreground whitespace-nowrap">
							{pagination.page} / {pagination.totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handlePageChange(pagination.page + 1)}
							disabled={pagination.page >= pagination.totalPages}
						>
							<span className="hidden sm:inline">Next</span>
							<IconChevronRight className="h-4 w-4 sm:ml-1" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
