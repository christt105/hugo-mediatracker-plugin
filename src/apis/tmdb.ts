import { MediaData, MediaImage, MediaType, SearchResult } from "@/types";
import { get_json } from "./http";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_ORIGINAL = "https://image.tmdb.org/t/p/original";
const IMG_THUMB = "https://image.tmdb.org/t/p/w342";

/**
 * A bundled TMDB v3 API key so the plugin works out of the box, the same as the
 * TheTVDB key. It is shared by everyone who hasn't set their own, so it may hit
 * rate limits when many users rely on it at once — set your own key in the
 * settings (it's free) to get a private, unthrottled quota.
 */
export const DEFAULT_TMDB_API_KEY = "99490ee31f30168287ef717608f10fc7";

interface TMDBSearchResult {
	id: number;
	media_type: string;
	title?: string;
	name?: string;
	original_title?: string;
	original_name?: string;
	release_date?: string;
	first_air_date?: string;
	poster_path?: string;
}

interface TMDBImage {
	file_path: string;
	width: number;
	height: number;
	vote_average: number;
	vote_count: number;
	iso_639_1: string | null;
}

interface TMDBVideo {
	site: string;
	type: string;
	key: string;
}

interface TMDBDetailResponse {
	id: number;
	title?: string;
	name?: string;
	original_title?: string;
	original_name?: string;
	release_date?: string;
	first_air_date?: string;
	overview?: string;
	poster_path?: string;
	backdrop_path?: string;
	genres?: { name: string }[];
	homepage?: string;
	tagline?: string;
	vote_average?: number;
	number_of_seasons?: number;
	credits?: {
		cast?: { name: string; character: string }[];
		crew?: { job: string; name: string }[];
	};
	videos?: { results?: TMDBVideo[] };
}

export class TMDBClient {
	constructor(
		private readonly api_key: string,
		private readonly include_adult = false,
	) {}

	get configured(): boolean {
		return !!this.api_key;
	}

	/** Search movies and TV shows at once (the "multi" endpoint). */
	async search(query: string, language: string): Promise<SearchResult[]> {
		const response = await get_json<{ total_results: number; results: TMDBSearchResult[] }>(
			`${TMDB_BASE}/search/multi`,
			this.auth_params({ query, page: 1, include_adult: this.include_adult, language }),
			this.auth_headers(),
		);
		if (!response.total_results) return [];
		return response.results
			.filter(r => r.media_type === "movie" || r.media_type === "tv")
			.map(r => this.to_search_result(r));
	}

	async get_details(id: number, type: MediaType, language: string): Promise<MediaData> {
		const path = type === "tv" ? "tv" : "movie";
		const r = await get_json<TMDBDetailResponse>(
			`${TMDB_BASE}/${path}/${id}`,
			this.auth_params({ language, append_to_response: "videos,credits" }),
			this.auth_headers(),
		);
		const release_date: string = r.release_date || r.first_air_date || "";
		return {
			type,
			title: r.title || r.name || "",
			original_title: r.original_title || r.original_name || "",
			release_date,
			year: release_date ? release_date.split("-")[0] : "",
			overview: clean(r.overview || ""),
			cover: r.poster_path ? IMG_ORIGINAL + r.poster_path : "",
			banner: r.backdrop_path ? IMG_ORIGINAL + r.backdrop_path : "",
			genres: (r.genres || []).map(g => g.name),
			rating: "",
			tmdb_id: r.id,
			director: (r.credits?.crew || []).find(c => c.job === "Director")?.name,
			main_actors: (r.credits?.cast || [])
				.slice(0, 10)
				.map(a => `${a.name} (${a.character})`),
			homepage: r.homepage || "",
			tagline: r.tagline || "",
			vote_average: r.vote_average,
			number_of_seasons: r.number_of_seasons,
			youtube_url: youtube_url(r.videos?.results || []),
		};
	}

	/** The TheTVDB id cross-referenced by TMDB for a show, when available. */
	async get_tvdb_id(tv_id: number): Promise<number | undefined> {
		const r = await get_json<{ tvdb_id?: number | null }>(
			`${TMDB_BASE}/tv/${tv_id}/external_ids`,
			this.auth_params({}),
			this.auth_headers(),
		);
		return r.tvdb_id ?? undefined;
	}

	/** Information for a single TV season, used when creating season notes. */
	async get_season(tv_id: number, season_number: number, language: string) {
		return get_json<{
			name: string;
			overview: string;
			air_date: string;
			poster_path?: string;
			episodes?: unknown[];
		}>(
			`${TMDB_BASE}/tv/${tv_id}/season/${season_number}`,
			this.auth_params({ language }),
			this.auth_headers(),
		);
	}

	/**
	 * Fetch poster/backdrop images. `languages` is an ordered list of ISO-639-1
	 * codes (e.g. `["es", "en"]`); images are returned grouped by that order so
	 * the user's preferred locale shows first, followed by language-agnostic art.
	 */
	async get_images(
		id: number,
		type: MediaType,
		kind: "poster" | "backdrop",
		languages: string[],
		season_number?: number,
	): Promise<MediaImage[]> {
		let path: string;
		if (type === "movie") path = `/movie/${id}/images`;
		else if (type === "season") path = `/tv/${id}/season/${season_number}/images`;
		else path = `/tv/${id}/images`;

		// Always include language-agnostic ("null") art as a fallback.
		const include = [...languages, "null"].join(",");
		const data = await get_json<{ posters: TMDBImage[]; backdrops: TMDBImage[] }>(
			`${TMDB_BASE}${path}`,
			this.auth_params({ include_image_language: include }),
			this.auth_headers(),
		);
		const list = kind === "poster" ? data.posters : data.backdrops;
		const rank = (lang: string | null) => {
			const index = languages.indexOf(lang ?? "");
			return index === -1 ? languages.length : index;
		};
		return (list || [])
			.sort((a, b) => rank(a.iso_639_1) - rank(b.iso_639_1) || b.vote_average - a.vote_average)
			.map(img => ({
				url: IMG_ORIGINAL + img.file_path,
				thumb: IMG_THUMB + img.file_path,
				width: img.width,
				height: img.height,
				source: img.iso_639_1 ? `TMDB · ${img.iso_639_1}` : "TMDB",
				score: img.vote_average,
			}));
	}

	private to_search_result(r: TMDBSearchResult): SearchResult {
		const release_date = r.release_date || r.first_air_date || "";
		return {
			id: r.id,
			media_type: r.media_type === "tv" ? "tv" : "movie",
			title: r.title || r.name || "",
			original_title: r.original_title || r.original_name || "",
			release_date,
			poster_path: r.poster_path ? IMG_THUMB + r.poster_path : "",
		};
	}

	/**
	 * TMDB accepts either a short v3 api key (query param) or a long v4 bearer
	 * token (Authorization header). We detect which one the user pasted.
	 */
	private uses_bearer(): boolean {
		return !!this.api_key && this.api_key.replace(/^Bearer\s+/i, "").length > 40;
	}

	private auth_params<T extends Record<string, unknown>>(params: T): T & { api_key?: string } {
		if (this.uses_bearer()) return params;
		return { ...params, api_key: this.api_key };
	}

	private auth_headers(): Record<string, string> {
		if (this.uses_bearer()) {
			const token = this.api_key.replace(/^Bearer\s+/i, "");
			return { Authorization: `Bearer ${token}` };
		}
		return {};
	}
}

function clean(text: string): string {
	return text.replace(/[\r\n]+/g, " ").trim();
}

function youtube_url(videos: { site: string; type: string; key: string }[]): string {
	const yt = videos.filter(v => v.site === "YouTube");
	const order = ["Trailer", "Clip", "Featurette", "Teaser"];
	for (const type of order) {
		const v = yt.find(video => video.type === type);
		if (v) return `https://www.youtube.com/watch?v=${v.key}`;
	}
	return "";
}
