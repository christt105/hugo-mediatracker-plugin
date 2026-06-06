import { stringifyYaml } from "obsidian";
import { MediaData } from "@/types";
import { FrontmatterCase, MediaTrackerSettings } from "@/settings";

/**
 * Build the note body for a media entry. When a template file is provided its
 * contents are used with `{{variable}}` substitution; otherwise a sensible
 * default frontmatter block (matching the Media Tracker template) is generated.
 */
export function render_note(
	media: MediaData,
	settings: MediaTrackerSettings,
	template_contents?: string,
): string {
	if (template_contents && template_contents.trim()) {
		return substitute_variables(template_contents, media);
	}
	const fm = default_frontmatter(media, settings);
	return `---\n${stringifyYaml(fm)}---\n`;
}

/** Generate the default frontmatter object for the given media type. */
export function default_frontmatter(
	media: MediaData,
	settings: MediaTrackerSettings,
): Record<string, unknown> {
	const status = settings.default_status;
	let fm: Record<string, unknown>;

	if (media.type === "videogame") {
		fm = {
			title: media.title,
			type: "videogame",
			date: "",
			rewatches: [],
			release_date: media.release_date,
			status,
			cover: media.cover,
			banner: media.banner,
			developer: media.developer ?? "",
			genres: media.genres,
			rating: "",
			igdb_id: media.igdb_id,
			steam_appid: media.steam_appid ?? "",
			tags: [],
			related: [],
			platforms: media.platforms ?? [],
			overview: media.overview,
		};
		if (media.steamgriddb_id) fm.steamgriddb_id = media.steamgriddb_id;
	} else if (media.type === "season") {
		fm = {
			title: media.title,
			type: "season",
			series: media.series_file ? `[[${media.series_file}]]` : "",
			season_number: media.season_number,
			status,
			cover: media.cover,
			banner: media.banner,
			date: "",
			rewatches: [],
			release_date: media.release_date,
			tags: [],
			rating: "",
		};
	} else {
		// movie or tv
		fm = {
			title: media.title,
			type: media.type,
			date: "",
			rewatches: [],
			release_date: media.release_date,
			status,
			cover: media.cover,
			banner: media.banner,
			rating: "",
			genres: media.genres,
			tmdb_id: media.tmdb_id,
			tags: [],
			related: [],
			overview: media.overview,
		};
		if (media.type === "tv") fm[settings.seasons_property] = [];
	}

	return settings.frontmatter_case === FrontmatterCase.camel ? to_camel_keys(fm) : fm;
}

/** Replace `{{variable}}` tokens with media values. Arrays become comma lists. */
export function substitute_variables(template: string, media: MediaData): string {
	return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
		const value = (media as Record<string, unknown>)[key];
		if (value === undefined || value === null) return "";
		if (Array.isArray(value)) return value.join(", ");
		return String(value);
	});
}

function to_camel_keys(obj: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		const camel = key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
		out[camel] = value;
	}
	return out;
}
