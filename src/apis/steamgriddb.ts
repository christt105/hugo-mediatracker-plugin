import { MediaImage } from "@/types";
import { get_json } from "./http";
import { steam_cover, steam_hero } from "./igdb";

const BASE = "https://www.steamgriddb.com/api/v2";

export interface SGDBGame {
	id: number;
	name: string;
	release_date?: number;
}

interface SGDBImage {
	url: string;
	thumb: string;
	width: number;
	height: number;
	score: number;
	author?: { name: string };
}

export class SteamGridDBClient {
	constructor(private readonly token: string) {}

	get configured(): boolean {
		return !!this.token;
	}

	async autocomplete(query: string): Promise<SGDBGame[]> {
		const data = await this.get<{ data: SGDBGame[] }>(`/search/autocomplete/${encodeURIComponent(query)}`);
		return data.data ?? [];
	}

	async game_by_steam_appid(appid: string): Promise<SGDBGame | null> {
		try {
			const data = await this.get<{ data: SGDBGame }>(`/games/steam/${appid}`);
			return data.data ?? null;
		} catch {
			return null;
		}
	}

	/**
	 * Fetch artwork for a game. Official Steam artwork (when a Steam app id is
	 * known) is offered first, followed by community grids/heroes.
	 */
	async images(
		sgdb_id: number,
		kind: "poster" | "backdrop",
		steam_appid?: string,
	): Promise<MediaImage[]> {
		const images: MediaImage[] = [];

		if (steam_appid) {
			const url = kind === "poster" ? steam_cover(steam_appid) : steam_hero(steam_appid);
			images.push({
				url,
				thumb: url,
				width: kind === "poster" ? 600 : 1920,
				height: kind === "poster" ? 900 : 620,
				source: "Steam (official)",
				score: Number.MAX_SAFE_INTEGER,
				steam_appid,
				steamgriddb_id: sgdb_id,
			});
		}

		const type = kind === "poster" ? "grids" : "heroes";
		const dimensions = kind === "poster" ? "600x900" : "1920x620,1600x650";
		const data = await this.get<{ data: SGDBImage[] }>(
			`/${type}/game/${sgdb_id}?dimensions=${dimensions}`,
		);
		for (const img of data.data ?? []) {
			images.push({
				url: img.url,
				thumb: img.thumb,
				width: img.width,
				height: img.height,
				source: img.author?.name ? `SteamGridDB · ${img.author.name}` : "SteamGridDB",
				score: img.score,
				steam_appid,
				steamgriddb_id: sgdb_id,
			});
		}
		return images;
	}

	private get<T>(path: string): Promise<T> {
		return get_json<T>(`${BASE}${path}`, {}, { Authorization: `Bearer ${this.token}` });
	}
}
