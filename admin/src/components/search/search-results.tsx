"use client";

import * as React from "react";
import Link from "next/link";
import { IconBriefcase, IconFileText } from "@tabler/icons-react";
import { SearchResult } from "@/services/searchService";
import { Button } from "@/components/ui/button";

interface SearchResultsProps {
	results: SearchResult[];
	query: string;
	isLoading?: boolean;
	onResultClick?: (result: SearchResult) => void;
}

const moduleIcons = {
	works: IconBriefcase,
	content: IconFileText,
};

const moduleColors = {
	works: "text-blue-600",
	content: "text-gray-600",
};

export function SearchResults({ results, query, isLoading, onResultClick }: SearchResultsProps) {
	if (isLoading) {
		return (
			<div className="space-y-2">
				{[...Array(3)].map((_, i) => (
					<div key={i} className="animate-pulse">
						<div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
						<div className="h-3 bg-muted rounded w-1/2"></div>
					</div>
				))}
			</div>
		);
	}

	if (results.length === 0 && query) {
		return (
			<div className="text-center py-6">
				<div className="text-muted-foreground">No results found for &quot;{query}&quot;</div>
				<div className="text-sm text-muted-foreground mt-1">Try searching with different keywords</div>
			</div>
		);
	}

	if (results.length === 0) {
		return (
			<div className="text-center py-6">
				<div className="text-muted-foreground">Start typing to search...</div>
			</div>
		);
	}

	// Group results by module
	const groupedResults = results.reduce(
		(acc, result) => {
			if (!acc[result.module]) {
				acc[result.module] = [];
			}
			acc[result.module].push(result);
			return acc;
		},
		{} as Record<string, SearchResult[]>,
	);

	return (
		<div className="space-y-4">
			{Object.entries(groupedResults).map(([module, moduleResults]) => {
				const Icon = moduleIcons[module as keyof typeof moduleIcons] || IconFileText;
				const colorClass = moduleColors[module as keyof typeof moduleColors] || "text-gray-600";

				return (
					<div key={module} className="space-y-2">
						<div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
							<Icon className={`h-4 w-4 ${colorClass}`} />
							<span className="capitalize">{module}</span>
							<span className="text-xs">({moduleResults.length})</span>
						</div>

						<div className="space-y-1">
							{moduleResults.map((result) => (
								<Button
									key={`${result.module}-${result.id}`}
									variant="ghost"
									className="w-full justify-start h-auto p-3 text-left"
									asChild
								>
									<Link href={result.url} onClick={() => onResultClick?.(result)}>
										<div className="space-y-1">
											<div className="font-medium">{result.title}</div>
											{result.description && (
												<div className="text-sm text-muted-foreground line-clamp-2">{result.description}</div>
											)}
											<div className="text-xs text-muted-foreground">
												{result.type} • Updated {new Date(result.updatedAt).toLocaleDateString()}
											</div>
										</div>
									</Link>
								</Button>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
