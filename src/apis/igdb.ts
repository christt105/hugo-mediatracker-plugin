import { MediaData, SearchResult } from "@/types";
import { request_json } from "./http";

const GAMES_URL = "https://api.igdb.com/v4/games";
const AUTH_URL = "https://id.twitch.tv/oauth2/token";

const FIELDS = `
	fields name, first_release_date, involved_companies.developer,
	involved_companies.company.name, involved_companies.company.logo.url,
	url, cover.url, genres.name, game_modes.name, storyline, summary,
	platforms.name, screenshots.url,
	external_games.external_game_source, external_games.uid;
`;

interface IGDBGame {
	id: number;
	name: string;
	first_release_date?: number;
	summary?: string;
	storyline?: string;
	cover?: { url: string };
	screenshots?: { url: string }[];
	genres?: { name: string }[];
	game_modes?: { name: string }[];
	platforms?: { name: string }[];
	involved_companies?: {
		developer: boolean;
		company: { name: string; logo?: { url: string } };
	}[];
	external_games?: { external_game_source: number; uid: string }[];
}

export interface IGDBTokenStore {
	token: string;
	expires_at: number;
	save(token: string, expires_at: number): Promise<void>;
}

export class IGDBClient {
	constructor(
		private readonly client_id: string,
		private readonly client_secret: string,
		private readonly tokens: IGDBTokenStore,
		/** Use official Steam artwork instead of IGDB cover/screenshot. */
		private readonly prefer_steam = true,
	) {}

	get configured(): boolean {
		return !!this.client_id && !!this.client_secret;
	}

	async search(query: string): Promise<SearchResult[]> {
		const games = await this.query_games(`${FIELDS} search "${escape_quotes(query)}"; limit 20;`);
		return games.map(g => ({
			id: g.id,
			media_type: "videogame" as const,
			title: g.name,
			release_date: this.release_date(g),
			poster_path: this.cover_url(g),
			raw: g,
		}));
	}

	/** IGDB search already returns full payloads, so reuse it when present. */
	to_media_data(result: SearchResult): MediaData {
		const g = result.raw as IGDBGame;
		const developer = g.involved_companies?.find(c => c.developer);
		const steam_appid = this.steam_appid(g);

		let cover = this.cover_url(g);
		let banner = this.screenshot_url(g);
		if (steam_appid && this.prefer_steam) {
			cover = steam_cover(steam_appid);
			banner = steam_hero(steam_appid);
		}

		const release_date = this.release_date(g);
		return {
			type: "videogame",
			title: g.name,
			original_title: g.name,
			release_date,
			year: release_date ? release_date.split("-")[0] : "",
			overview: clean(g.storyline || g.summary || ""),
			cover,
			banner,
			genres: (g.genres || []).map(x => x.name),
			rating: "",
			igdb_id: g.id,
			steam_appid: steam_appid || undefined,
			developer: developer?.company.name,
			developer_logo: developer?.company.logo
				? "https:" + developer.company.logo.url.replace("thumb", "logo_med")
				: undefined,
			available_platforms: (g.platforms || []).map(x => x.name),
			game_modes: (g.game_modes || []).map(x => x.name),
		};
	}

	private async query_games(body: string, retried = false): Promise<IGDBGame[]> {
		const token = await this.ensure_token();
		try {
			return await request_json<IGDBGame[]>({
				url: GAMES_URL,
				method: "POST",
				headers: { "Client-ID": this.client_id, Authorization: `Bearer ${token}` },
				body,
			});
		} catch (error) {
			// A 401 usually means the token expired server-side; refresh once.
			if (!retried) {
				await this.refresh_token();
				return this.query_games(body, true);
			}
			throw error;
		}
	}

	private async ensure_token(): Promise<string> {
		const now = Date.now();
		if (this.tokens.token && this.tokens.expires_at > now + 60_000) return this.tokens.token;
		return this.refresh_token();
	}

	private async refresh_token(): Promise<string> {
		const url = new URL(AUTH_URL);
		url.searchParams.append("client_id", this.client_id);
		url.searchParams.append("client_secret", this.client_secret);
		url.searchParams.append("grant_type", "client_credentials");

		const auth = await request_json<{ access_token: string; expires_in: number }>({
			url: url.href,
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});
		if (!auth.access_token) throw new Error("IGDB authentication failed. Check your client id/secret.");
		const expires_at = Date.now() + auth.expires_in * 1000;
		await this.tokens.save(auth.access_token, expires_at);
		return auth.access_token;
	}

	private release_date(g: IGDBGame): string {
		if (!g.first_release_date) return "";
		return new Date(g.first_release_date * 1000).toISOString().split("T")[0];
	}

	private cover_url(g: IGDBGame): string {
		return g.cover ? "https:" + g.cover.url.replace("thumb", "cover_big") : "";
	}

	private screenshot_url(g: IGDBGame): string {
		const shot = g.screenshots?.[0];
		return shot ? "https:" + shot.url.replace("thumb", "screenshot_huge") : "";
	}

	private steam_appid(g: IGDBGame): string {
		// IGDB external_game_source 1 == Steam.
		const steam = g.external_games?.find(e => e.external_game_source === 1);
		return steam ? steam.uid : "";
	}
}

export function steam_cover(appid: string): string {
	return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`;
}

export function steam_hero(appid: string): string {
	return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`;
}

function clean(text: string): string {
	return text.replace(/[\r\n]+/g, " ").trim();
}

function escape_quotes(text: string): string {
	return text.replace(/"/g, '\\"');
}
