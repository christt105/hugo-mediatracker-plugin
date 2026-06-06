// Shared data models used across the plugin.

export type MediaType = "movie" | "tv" | "season" | "videogame";

export type Provider = "tmdb" | "thetvdb";

export type ImageKind = "poster" | "backdrop";

/** A lightweight result returned by a search, used to populate the chooser. */
export interface SearchResult {
	/** Provider id (TMDB id, IGDB id, ...). */
	id: number;
	media_type: MediaType;
	title: string;
	/** Original title / alternative label, shown as secondary text. */
	original_title?: string;
	/** YYYY-MM-DD when known. */
	release_date?: string;
	/** Small image used as a thumbnail in the chooser. */
	poster_path?: string;
	/** Which service produced this result (drives the detail fetch). */
	provider?: Provider;
	/** Provider specific payload so the detail fetch can reuse it. */
	raw?: unknown;
}

/**
 * Fully normalised media entry. Every field is exposed to templates as a
 * `{{variable}}` and used to build the default frontmatter.
 */
export interface MediaData {
	type: MediaType;
	title: string;
	original_title: string;
	release_date: string;
	year: string;
	overview: string;
	cover: string;
	banner: string;
	genres: string[];
	rating: string;

	// Movies / TV
	tmdb_id?: number;
	thetvdb_id?: number;
	director?: string;
	main_actors?: string[];
	homepage?: string;
	tagline?: string;
	youtube_url?: string;
	number_of_seasons?: number;
	vote_average?: number;

	// Video games
	igdb_id?: number;
	steam_appid?: string;
	steamgriddb_id?: number;
	developer?: string;
	developer_logo?: string;
	/** Platforms the game is available on (from IGDB). */
	available_platforms?: string[];
	game_modes?: string[];

	// Season
	season_number?: number;
	series_file?: string;

	// Anything else providers want to surface to templates.
	[key: string]: unknown;
}

/** A selectable image returned by an image provider. */
export interface MediaImage {
	url: string;
	thumb: string;
	width?: number;
	height?: number;
	/** Human readable origin: "TMDB", "Steam", author name... */
	source: string;
	/** Sorting hint, higher is better. */
	score?: number;
	/** IDs discovered while fetching, persisted back to the note if chosen. */
	steam_appid?: string;
	steamgriddb_id?: number;
}
