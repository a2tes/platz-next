"use client";

import * as React from "react";
import { IconSearch, IconClock } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface SearchSuggestionsProps {
	suggestions: string[];
	recentSearches: string[];
	onSuggestionClick: (suggestion: string) => void;
	onRecentSearchClick: (search: string) => void;
}

export function SearchSuggestions({
	suggestions,
	recentSearches,
	onSuggestionClick,
	onRecentSearchClick,
}: SearchSuggestionsProps) {
	return (
		<div className="space-y-4">
			{/* Recent Searches */}
			{recentSearches.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
						<IconClock className="h-4 w-4" />
						<span>Recent Searches</span>
					</div>
					<div className="space-y-1">
						{recentSearches.slice(0, 3).map((search, index) => (
							<Button
								key={index}
								variant="ghost"
								className="w-full justify-start h-auto p-2 text-left"
								onClick={() => onRecentSearchClick(search)}
							>
								<IconClock className="h-4 w-4 mr-2 text-muted-foreground" />
								<span>{search}</span>
							</Button>
						))}
					</div>
				</div>
			)}

			{/* Suggestions */}
			{suggestions.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
						<IconSearch className="h-4 w-4" />
						<span>Suggestions</span>
					</div>
					<div className="space-y-1">
						{suggestions.slice(0, 5).map((suggestion, index) => (
							<Button
								key={index}
								variant="ghost"
								className="w-full justify-start h-auto p-2 text-left"
								onClick={() => onSuggestionClick(suggestion)}
							>
								<IconSearch className="h-4 w-4 mr-2 text-muted-foreground" />
								<span>{suggestion}</span>
							</Button>
						))}
					</div>
				</div>
			)}

			{/* Empty state */}
			{suggestions.length === 0 && recentSearches.length === 0 && (
				<div className="text-center py-6">
					<div className="text-muted-foreground">Search across all modules including works and content pages.</div>
				</div>
			)}
		</div>
	);
}
