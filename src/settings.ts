import { MediaType } from "@/types";

export enum FrontmatterCase {
	snake = "snake_case",
	camel = "camelCase",
}

export interface MediaTrackerSettings {
	// --- TMDB (movies / tv) ---
	tmdb_api_key: string;
	locale_preference: string;
	ask_preferred_locale: boolean;
	include_adult: boolean;

	// --- IGDB (games) ---
	igdb_client_id: string;
	igdb_client_secret: string;
	/** Cached OAuth token, refreshed automatically. */
	igdb_access_token: string;
	igdb_token_expires_at: number;
	/** Prefer official Steam artwork over IGDB cover/screenshot when available. */
	prefer_steam_artwork: boolean;

	// --- SteamGridDB (artwork) ---
	steamgriddb_token: string;

	// --- Note creation ---
	movies_folder: string;
	tv_folder: string;
	seasons_folder: string;
	games_folder: string;
	file_name_format: string;
	default_status: string;
	open_note_on_creation: boolean;
	overwrite_without_asking: boolean;

	/** Property name on the show note that holds the list of season links. */
	seasons_property: string;
	season_label: string;

	/** Optional template file overrides per media type (empty = built-in). */
	template_movie: string;
	template_tv: string;
	template_season: string;
	template_game: string;

	frontmatter_case: FrontmatterCase;

	// --- Internal ---
	recent_locales: { [locale: string]: number };
}

export const DEFAULT_SETTINGS: MediaTrackerSettings = {
	tmdb_api_key: "",
	locale_preference: "auto",
	ask_preferred_locale: false,
	include_adult: false,

	igdb_client_id: "",
	igdb_client_secret: "",
	igdb_access_token: "",
	igdb_token_expires_at: 0,
	prefer_steam_artwork: true,

	steamgriddb_token: "",

	movies_folder: "Media Tracker/Movies",
	tv_folder: "Media Tracker/TVs",
	seasons_folder: "Media Tracker/Seasons",
	games_folder: "Media Tracker/Games",
	file_name_format: "{{title}} ({{year}})",
	default_status: "Not Started",
	open_note_on_creation: true,
	overwrite_without_asking: false,

	seasons_property: "seasons",
	season_label: "Season",

	template_movie: "",
	template_tv: "",
	template_season: "",
	template_game: "",

	frontmatter_case: FrontmatterCase.snake,

	recent_locales: {},
};

export function folder_for(settings: MediaTrackerSettings, type: MediaType): string {
	switch (type) {
		case "movie":
			return settings.movies_folder;
		case "tv":
			return settings.tv_folder;
		case "season":
			return settings.seasons_folder;
		case "videogame":
			return settings.games_folder;
	}
}

export function template_for(settings: MediaTrackerSettings, type: MediaType): string {
	switch (type) {
		case "movie":
			return settings.template_movie;
		case "tv":
			return settings.template_tv;
		case "season":
			return settings.template_season;
		case "videogame":
			return settings.template_game;
	}
}
