"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ContentPageForm } from "./ContentPageForm";
import { ContentService, type ContentPage } from "@/services/contentService";

export function LegalForm({
	id,
	...props
}: {
	id?: number;
	onClose?: () => void;
	onSuccess?: (data: ContentPage) => void;
}) {
	const queryClient = useQueryClient();
	const isEdit = !!id;
	return (
		<ContentPageForm
			queryKey={isEdit ? `legal:${id}` : "legal:new"}
			getPage={() =>
				isEdit
					? ContentService.getLegalById(id!)
					: Promise.resolve(null as unknown as ContentPage)
			}
			updatePage={(payload) =>
				isEdit
					? ContentService.updateLegalById(id!, payload)
					: ContentService.createLegal(payload)
			}
			editorKeyPrefix={isEdit ? `legal-${id}` : "legal-new"}
			{...props}
			onSuccess={(data) => {
				queryClient.invalidateQueries({ queryKey: ["legal-pages"] });
				queryClient.invalidateQueries({ queryKey: ["legal-pages-counts"] });
				props.onSuccess?.(data);
			}}
		/>
	);
}
