declare module "@editorjs/editorjs" {
	export interface OutputBlockData {
		id?: string;
		type: string;
		data: unknown;
	}
	export interface OutputData {
		time?: number;
		blocks: OutputBlockData[];
		version?: string;
	}
	export default class EditorJS {
		constructor(config: unknown);
		destroy(): void;
		save(): Promise<OutputData>;
	}
}

declare module "@editorjs/header" {
	const Header: unknown;
	export default Header;
}
declare module "@editorjs/list" {
	const List: unknown;
	export default List;
}
declare module "@editorjs/quote" {
	const Quote: unknown;
	export default Quote;
}
declare module "@editorjs/delimiter" {
	const Delimiter: unknown;
	export default Delimiter;
}

declare module "@editorjs/marker" {
	const Marker: unknown;
	export default Marker;
}
declare module "@editorjs/inline-code" {
	const InlineCode: unknown;
	export default InlineCode;
}
declare module "@editorjs/code" {
	const Code: unknown;
	export default Code;
}
declare module "@editorjs/table" {
	const Table: unknown;
	export default Table;
}
declare module "@editorjs/checklist" {
	const Checklist: unknown;
	export default Checklist;
}
