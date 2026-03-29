"use client";

import * as React from "react";
import { Sidebar } from "./navbar";
import { MediaLibraryModal } from "../media/MediaLibraryModal";
import { BlockEditorModal } from "../blocks/BlockEditorModal";

interface AdminLayoutProps {
	children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<div className="min-h-screen bg-background">
			<Sidebar />
			<div className="md:pl-56 md:pt-14">
				<main className="px-6 py-6">{children}</main>
			</div>
			<MediaLibraryModal />
			<BlockEditorModal />
		</div>
	);
}
