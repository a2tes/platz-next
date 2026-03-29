/**
 * Safely get a route parameter as a string
 * Express route params can be string | string[] in some cases
 */
export function getParam(params: Record<string, string | string[] | undefined>, key: string): string {
	const value = params[key];
	if (Array.isArray(value)) {
		return value[0] ?? "";
	}
	return value ?? "";
}

/**
 * Safely parse a route parameter as an integer
 */
export function getParamInt(params: Record<string, string | string[] | undefined>, key: string): number {
	return parseInt(getParam(params, key), 10);
}
