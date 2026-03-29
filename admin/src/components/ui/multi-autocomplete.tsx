"use client";

import * as React from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
	id: number;
	name: string;
}

interface MultiAutocompleteProps {
	values?: AutocompleteOption[];
	onValuesChange?: (options: AutocompleteOption[]) => void;
	options: AutocompleteOption[];
	onSearch?: (query: string) => void;
	onCreateNew?: (name: string) => Promise<AutocompleteOption>;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyMessage?: string;
	allowCreate?: boolean;
	loading?: boolean;
	disabled?: boolean;
	className?: string;
	maxDisplayed?: number;
	/** Single select mode - only one option can be selected */
	single?: boolean;
}

export function MultiAutocomplete({
	values = [],
	onValuesChange,
	options,
	onSearch,
	onCreateNew,
	placeholder = "Select...",
	searchPlaceholder = "Search...",
	emptyMessage = "No results found.",
	allowCreate = true,
	loading = false,
	disabled = false,
	className,
	maxDisplayed = 3,
	single = false,
}: MultiAutocompleteProps) {
	const [open, setOpen] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [isCreating, setIsCreating] = React.useState(false);

	// Reset search query when dropdown opens/closes
	React.useEffect(() => {
		if (!open) {
			setSearchQuery("");
			onSearch?.("");
		}
	}, [open, onSearch]);

	const handleSearch = (query: string) => {
		setSearchQuery(query);
		onSearch?.(query);
	};

	const handleSelect = (option: AutocompleteOption) => {
		const isSelected = values.some((v) => v.id === option.id);

		if (isSelected) {
			// Remove from selection
			onValuesChange?.(values.filter((v) => v.id !== option.id));
		} else if (single) {
			// Single mode: replace selection
			onValuesChange?.([option]);
			setOpen(false);
		} else {
			// Add to selection
			onValuesChange?.([...values, option]);
		}

		setSearchQuery("");
	};

	const handleCreate = async () => {
		if (!onCreateNew || !searchQuery.trim()) return;

		setIsCreating(true);
		try {
			const newOption = await onCreateNew(searchQuery.trim());
			handleSelect(newOption);
			// Close dropdown after creating
			setOpen(false);
		} catch (error) {
			console.error("Failed to create:", error);
		} finally {
			setIsCreating(false);
		}
	};

	// Check if search query matches any existing option
	const queryMatchesExisting = options.some((opt) => opt?.name?.toLowerCase() === searchQuery.toLowerCase());
	const showCreateOption = allowCreate && onCreateNew && searchQuery.trim() && !queryMatchesExisting;

	// Display text for the trigger button
	const displayedValues = values.slice(0, maxDisplayed);
	const remainingCount = values.length - maxDisplayed;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						"w-full min-h-10 h-auto justify-between font-normal group",
						values.length > 0 && "py-1.5",
						className,
					)}
				>
					<div className="flex flex-wrap gap-1 flex-1">
						{values.length === 0 ? (
							<span className="text-muted-foreground">{placeholder}</span>
						) : (
							<>
								{displayedValues.map((value) => (
									<Badge
										key={value.id}
										variant="secondary"
										className="text-xs font-normal group-hover:bg-muted-foreground/20"
									>
										{value.name}
									</Badge>
								))}
								{remainingCount > 0 && (
									<Badge variant="outline" className="text-xs font-normal">
										+{remainingCount} more
									</Badge>
								)}
							</>
						)}
					</div>
					<IconChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput placeholder={searchPlaceholder} value={searchQuery} onValueChange={handleSearch} />
					<CommandList>
						{loading ? (
							<div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
						) : (
							<>
								{options.length === 0 && !showCreateOption && <CommandEmpty>{emptyMessage}</CommandEmpty>}
								<CommandGroup>
									{options.filter(Boolean).map((option) => {
										const isSelected = values.some((v) => v.id === option.id);
										return (
											<CommandItem key={option.id} value={option.name} onSelect={() => handleSelect(option)}>
												<IconCheck className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
												{option.name}
											</CommandItem>
										);
									})}
									{showCreateOption && (
										<CommandItem value={`create-${searchQuery}`} onSelect={handleCreate} disabled={isCreating}>
											<span className="text-primary">{isCreating ? "Creating..." : `Create "${searchQuery}"`}</span>
										</CommandItem>
									)}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
