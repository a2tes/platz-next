"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Create a client
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 0, // Always consider data stale
			gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes but always refetch
			refetchOnMount: true, // Refetch on mount
			refetchOnWindowFocus: false, // Don't refetch on focus
			refetchOnReconnect: false, // Don't refetch on reconnect
			refetchInterval: false, // No automatic refetching
			retry: 1,
			networkMode: "online",
		},
		mutations: {
			retry: 1,
			networkMode: "online",
		},
	},
});

interface ProvidersProps {
	children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider defaultTheme="system" storageKey="ui-theme">
				{children}
				<Toaster />
			</ThemeProvider>
		</QueryClientProvider>
	);
}
