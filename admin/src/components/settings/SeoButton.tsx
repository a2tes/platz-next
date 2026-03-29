"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { IconSparkles } from "@tabler/icons-react";
import { SeoSettingsModal } from "@/components/settings/SeoSettingsModal";

interface SeoButtonProps {
	pageKey: string;
	pageTitle: string;
}

export function SeoButton({ pageKey, pageTitle }: SeoButtonProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<>
			<Button variant="outline" onClick={() => setOpen(true)} title={`SEO Settings — ${pageTitle}`}>
				<IconSparkles className="h-4 w-4" /> SEO
			</Button>
			<SeoSettingsModal open={open} onOpenChange={setOpen} pageKey={pageKey} pageTitle={pageTitle} />
		</>
	);
}
