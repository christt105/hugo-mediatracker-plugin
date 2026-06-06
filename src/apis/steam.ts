import { get_json } from "./http";

export interface SteamSearchItem {
	id: number;
	name: string;
}

/** Search the public Steam store for an app, used to resolve a missing app id. */
export async function search_steam(query: string): Promise<SteamSearchItem[]> {
	const data = await get_json<{ items?: SteamSearchItem[] }>(
		"https://store.steampowered.com/api/storesearch/",
		{ term: query, l: "english", cc: "US" },
	);
	return data.items ?? [];
}
