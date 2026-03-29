"use client";

import * as React from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
	id: number;
	name: string;
}

interface AutocompleteProps {
	value?: AutocompleteOption | null;
	onValueChange?: (option: AutocompleteOption | null) => void;
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
}

export function Autocomplete({
	value,
	onValueChange,
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
}: AutocompleteProps) {
	const [open, setOpen] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [isCreating, setIsCreating] = React.useState(false);

	const handleSearch = (query: string) => {
		setSearchQuery(query);
		onSearch?.(query);
	};

	const handleSelect = (option: AutocompleteOption) => {
		onValueChange?.(option);
		setOpen(false);
		setSearchQuery("");
	};

	const handleClear = (e: React.MouseEvent) => {
		e.stopPropagation();
		onValueChange?.(null);
	};

	const handleCreate = async () => {
		if (!onCreateNew || !searchQuery.trim()) return;

		setIsCreating(true);
		try {
			const newOption = await onCreateNew(searchQuery.trim());
			handleSelect(newOption);
		} catch (error) {
			console.error("Failed to create:", error);
		} finally {
			setIsCreating(false);
		}
	};

	// Check if search query matches any existing option
	const queryMatchesExisting = options.some((opt) => opt?.name?.toLowerCase() === searchQuery.toLowerCase());
	const showCreateOption = allowCreate && onCreateNew && searchQuery.trim() && !queryMatchesExisting;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn("w-full justify-between font-normal", className)}
				>
					<span className={cn("truncate", !value && "text-muted-foreground")}>{value?.name || placeholder}</span>
					<div className="flex items-center gap-1 ml-2 shrink-0">
						{value && <IconX className="h-3 w-3 opacity-50 hover:opacity-100" onClick={handleClear} />}
						<IconChevronDown className="h-4 w-4 opacity-50" />
					</div>
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
									{options.filter(Boolean).map((option) => (
										<CommandItem key={option.id} value={option.name} onSelect={() => handleSelect(option)}>
											<IconCheck
												className={cn("mr-2 h-4 w-4", value?.id === option.id ? "opacity-100" : "opacity-0")}
											/>
											{option.name}
										</CommandItem>
									))}
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
