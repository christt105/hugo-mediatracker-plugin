import { requestUrl, RequestUrlParam } from "obsidian";

export interface HttpError extends Error {
	status?: number;
}

/** GET a JSON document, appending `params` as a query string. */
export async function get_json<T>(
	url: string,
	params: Record<string, string | number | boolean | undefined> = {},
	headers: Record<string, string> = {},
): Promise<T> {
	const api_url = new URL(url);
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== "") api_url.searchParams.append(key, String(value));
	});
	return request_json<T>({
		url: api_url.href,
		method: "GET",
		headers: {
			Accept: "application/json",
			...headers,
		},
	});
}

/** Generic request that throws an {@link HttpError} carrying the status code. */
export async function request_json<T>(params: RequestUrlParam): Promise<T> {
	const response = await requestUrl({ throw: false, ...params });
	if (response.status < 200 || response.status >= 300) {
		const error: HttpError = new Error(
			`Request failed (${response.status}) for ${params.url}`,
		);
		error.status = response.status;
		throw error;
	}
	return response.json as T;
}
