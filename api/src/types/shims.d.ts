declare module "sanitize-html";
declare module "editorjs-html";

// Fix Express params type - override to be string only since route params are always strings
declare global {
	namespace Express {
		interface Request {
			params: Record<string, string>;
		}
	}
}
