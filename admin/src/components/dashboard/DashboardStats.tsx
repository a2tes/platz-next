"use client";

import { useState, useEffect, useCallback } from "react";
import { IconRefresh, IconAlertTriangle } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardService, DashboardStats as DashboardStatsType } from "../../services/dashboardService";

interface DashboardStatsProps {
	className?: string;
}

export default function DashboardStats({ className = "" }: DashboardStatsProps) {
	const [stats, setStats] = useState<DashboardStatsType | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [period, setPeriod] = useState(30);

	const fetchStats = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await DashboardService.getDashboardStats(period);
			setStats(data);
		} catch (err) {
			console.error("Error fetching dashboard stats:", err);
			setError("Failed to load statistics");
		} finally {
			setLoading(false);
		}
	}, [period]);

	useEffect(() => {
		fetchStats();
	}, [fetchStats]);

	// Format published/draft text by omitting zero values
	const formatPubDraft = (published: number, draft: number) => {
		if (published > 0 && draft > 0) return `${published} published, ${draft} draft`;
		if (published > 0) return `${published} published`;
		if (draft > 0) return `${draft} draft`;
		return "0";
	};

	if (loading) {
		return (
			<div className={`space-y-6 ${className}`}>
				<Card>
					<CardHeader className="border-b">
						<CardTitle>Overview</CardTitle>
						<div data-slot="card-action">
							<Skeleton className="h-9 w-36" />
						</div>
					</CardHeader>
					<CardContent className="pt-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
							{[...Array(8)].map((_, i) => (
								<Card key={i}>
									<CardHeader className="pb-3">
										<Skeleton className="h-4 w-24 mb-2" />
										<Skeleton className="h-8 w-16" />
									</CardHeader>
									<CardContent>
										<Skeleton className="h-3 w-32" />
									</CardContent>
								</Card>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error || !stats) {
		return (
			<Card className={className}>
				<CardContent className="pt-6">
					<div className="text-center space-y-4">
						<IconAlertTriangle className="mx-auto h-12 w-12 text-destructive" />
						<div>
							<h3 className="font-semibold text-lg mb-1">Failed to load statistics</h3>
							<p className="text-muted-foreground text-sm">{error}</p>
						</div>
						<Button onClick={fetchStats} variant="outline">
							<IconRefresh className="mr-2 h-4 w-4" />
							Try Again
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	const statCards = [
		{
			title: "Homepage",
			url: "/homepage",
			value: 0,
			subtext: "",
		},
		{
			title: "Works",
			url: "/works",
			value: stats.contentStats.works.total,
			subtext: formatPubDraft(stats.contentStats.works.published, stats.contentStats.works.draft),
		},
		{
			title: "Users",
			url: "/users",
			value: stats.contentStats.users.total,
			subtext: formatPubDraft(stats.contentStats.users.published, stats.contentStats.users.draft),
		},
		{
			title: "Media Files",
			value: DashboardService.formatFileSize(stats.contentStats.mediaFiles.storageSize),
			subtext: `${stats.contentStats.mediaFiles.total} files`,
		},
	];

	return (
		<TooltipProvider>
			<div className={`flex flex-col gap-8 ${className}`}>
				<Card className="gap-2 !rounded-3xl pt-4">
					<CardHeader className="flex items-center justify-between">
						<CardTitle>Overview</CardTitle>
						<div data-slot="card-action">
							<Select value={period.toString()} onValueChange={(value: string) => setPeriod(Number(value))}>
								<SelectTrigger className="w-[180px]">
									<SelectValue placeholder="Select period" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1">Last 24 hours</SelectItem>
									<SelectItem value="7">Last 7 days</SelectItem>
									<SelectItem value="30">Last 30 days</SelectItem>
									<SelectItem value="90">Last 90 days</SelectItem>
									<SelectItem value="365">Last year</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
							{statCards.map((card, index) => {
								const content = (
									<Card className="transition-colors hover:bg-muted/40" key={index}>
										<CardContent className="flex flex-col items-center gap-1">
											<div className="text-2xl font-bold tracking-tight">{card.value.toLocaleString()}</div>
											<p className="text-sm font-medium text-muted-foreground">{card.title}</p>
											<p className="text-xs text-muted-foreground">{card.subtext}</p>
										</CardContent>
									</Card>
								);

								return card.url ? (
									<Link
										key={index}
										href={card.url}
										className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
										aria-label={`Go to ${card.title}`}
									>
										{content}
									</Link>
								) : (
									<div key={index}>{content}</div>
								);
							})}
						</div>
					</CardContent>
					{/* <CardHeader className="mt-4">
						<CardTitle>Activity Breakdown</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{[...stats.activityStats.stats]
								.sort((a, b) => b.count - a.count)
								.map((stat, index) => {
									const total = stats.activityStats.totalActivities;
									const percent = total > 0 ? (stat.count / total) * 100 : 0;
									return (
										<Card
											key={index}
											className="transition-colors hover:bg-muted/40 p-0"
										>
											<CardContent className="p-4">
												<div className="flex items-baseline gap-2">
													<div className="text-2xl font-bold">{stat.count}</div>
													<div className="text-xs text-muted-foreground lowercase">
														{DashboardService.formatModuleName(stat.module)}{" "}
														items {stat.action}
													</div>
												</div>
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="mt-2 h-1.5 w-full rounded-full bg-muted">
															<div
																className="h-1.5 rounded-full bg-muted-foreground/50 transition-all"
																style={{ width: `${percent}%` }}
															/>
														</div>
													</TooltipTrigger>
													<TooltipContent
														side="bottom"
														align="center"
														className="px-2 py-1 text-xs"
													>
														{percent.toFixed(1)}% of total
													</TooltipContent>
												</Tooltip>
											</CardContent>
										</Card>
									);
								})}
						</div>
					</CardContent> */}
				</Card>
			</div>
		</TooltipProvider>
	);
}
