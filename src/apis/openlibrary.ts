import { MediaData, SearchResult } from "@/types";
import { get_json } from "./http";

const SEARCH_URL = "https://openlibrary.org/search.json";
const WORKS_BASE = "https://openlibrary.org";
const COVERS_BASE = "https://covers.openlibrary.org/b";

/**
 * Fields requested from the search endpoint. Open Library returns most of what
 * we need in the search payload itself; only the long description lives on the
 * work, fetched lazily in {@link OpenLibraryClient.to_media_data}.
 */
const SEARCH_FIELDS = [
	"key",
	"title",
	"author_name",
	"first_publish_year",
	"cover_i",
	"cover_edition_key",
	"number_of_pages_median",
	"subject",
	"publisher",
	"isbn",
	"language",
].join(",");

interface OLSearchDoc {
	/** Work key, e.g. "/works/OL27482W". */
	key: string;
	title: string;
	author_name?: string[];
	first_publish_year?: number;
	cover_i?: number;
	/** Edition OLID used as a cover fallback when `cover_i` is missing. */
	cover_edition_key?: string;
	number_of_pages_median?: number;
	subject?: string[];
	publisher?: string[];
	isbn?: string[];
}

interface OLWork {
	/** Either a plain string or a typed text object, depending on the record. */
	description?: string | { value: string };
	subjects?: string[];
}

interface OLEdition {
	title?: string;
	subtitle?: string;
	/** e.g. [{ key: "/languages/spa" }]. */
	languages?: { key: string }[];
	/** Cover image ids; -1 means "no cover". */
	covers?: number[];
	publishers?: string[];
	isbn_13?: string[];
	isbn_10?: string[];
}

/**
 * Open Library (openlibrary.org) is a free, fully open catalogue from the
 * Internet Archive. It needs **no API key** and imposes only light rate limits,
 * which makes it the easiest book source to ship — users can search straight
 * away without registering anything.
 */
export class OpenLibraryClient {
	constructor(
		/**
		 * Optional 3-letter MARC language code (e.g. "eng", "spa", "fre") used to
		 * bias search results and to pick a localized edition title/cover. Note
		 * that Open Library uses MARC bibliographic codes ("fre", "ger"), which
		 * differ from the ISO-639-2/T codes some other providers use.
		 */
		private readonly language = "",
	) {}

	async search(query: string): Promise<SearchResult[]> {
		const params: Record<string, string | number> = {
			q: query,
			limit: 20,
			fields: SEARCH_FIELDS,
		};
		if (this.language) params.language = this.language;

		const data = await get_json<{ docs: OLSearchDoc[] }>(SEARCH_URL, params);
		return (data.docs ?? []).map(doc => ({
			id: olid_number(doc.key),
			media_type: "book" as const,
			title: doc.title,
			original_title: (doc.author_name ?? []).join(", "),
			release_date: doc.first_publish_year ? String(doc.first_publish_year) : "",
			poster_path: cover_url(doc, "M"),
			raw: doc,
		}));
	}

	/**
	 * Build a full book entry. The search doc already carries authors, cover and
	 * publishing info; only the synopsis needs a follow-up request to the work.
	 */
	async to_media_data(result: SearchResult): Promise<MediaData> {
		const doc = result.raw as OLSearchDoc;
		// The synopsis lives on the work (usually English); a localized title and
		// cover, when the locale is non-English, come from a matching edition.
		const [overview, edition] = await Promise.all([
			this.fetch_description(doc.key),
			this.localized_edition(doc.key),
		]);

		const authors = doc.author_name ?? [];
		const year = doc.first_publish_year ? String(doc.first_publish_year) : "";

		// Start from the canonical work data, then prefer the localized edition.
		let title = doc.title;
		let cover = cover_url(doc, "L");
		let publisher = (doc.publisher ?? [])[0];
		let isbn = (doc.isbn ?? [])[0];
		if (edition?.title) {
			title = edition.subtitle ? `${edition.title}: ${edition.subtitle}` : edition.title;
			const cover_id = (edition.covers ?? []).find(c => c > 0);
			if (cover_id) cover = `${COVERS_BASE}/id/${cover_id}-L.jpg`;
			publisher = (edition.publishers ?? [])[0] ?? publisher;
			isbn = (edition.isbn_13 ?? [])[0] ?? (edition.isbn_10 ?? [])[0] ?? isbn;
		}

		return {
			type: "book",
			title,
			original_title: doc.title,
			release_date: year,
			year,
			overview: clean(overview),
			cover,
			banner: "",
			genres: subjects(doc.subject),
			rating: "",
			openlibrary_id: work_id(doc.key),
			author: authors[0],
			authors,
			publisher,
			isbn,
			page_count: doc.number_of_pages_median,
		};
	}

	/**
	 * Find an edition published in the preferred language, preferring one that
	 * carries its own cover art. Returns null for English/unset locales (the
	 * canonical work data is already English) or when no edition matches.
	 */
	private async localized_edition(work_key: string): Promise<OLEdition | null> {
		if (!this.language || this.language === "eng") return null;
		try {
			const data = await get_json<{ entries: OLEdition[] }>(
				`${WORKS_BASE}${work_key}/editions.json`,
				{ limit: 50 },
			);
			const target = `/languages/${this.language}`;
			const matches = (data.entries ?? []).filter(
				e => e.title && (e.languages ?? []).some(l => l.key === target),
			);
			if (!matches.length) return null;
			return matches.find(e => (e.covers ?? []).some(c => c > 0)) ?? matches[0];
		} catch (error) {
			console.warn("Media Tracker: could not fetch Open Library editions", error);
			return null;
		}
	}

	private async fetch_description(work_key: string): Promise<string> {
		try {
			const work = await get_json<OLWork>(`${WORKS_BASE}${work_key}.json`);
			const desc = work.description;
			if (typeof desc === "string") return desc;
			if (desc?.value) return desc.value;
		} catch (error) {
			console.warn("Media Tracker: could not fetch Open Library description", error);
		}
		return "";
	}
}

/** Cover image URL by id (preferred) or edition OLID, at the requested size. */
function cover_url(doc: OLSearchDoc, size: "S" | "M" | "L"): string {
	if (doc.cover_i) return `${COVERS_BASE}/id/${doc.cover_i}-${size}.jpg`;
	if (doc.cover_edition_key) return `${COVERS_BASE}/olid/${doc.cover_edition_key}-${size}.jpg`;
	return "";
}

/** Extract the work OLID, e.g. "/works/OL27482W" -> "OL27482W". */
function work_id(key: string): string {
	return key.replace(/^\/works\//, "");
}

/** A numeric handle for {@link SearchResult.id}, derived from the work OLID. */
function olid_number(key: string): number {
	const digits = work_id(key).replace(/\D/g, "");
	return Number(digits) || 0;
}

/**
 * Open Library subjects are a long, noisy list (places, characters, themes...).
 * Keep the first few short, word-like ones as genres.
 */
function subjects(list: string[] | undefined): string[] {
	return (list ?? [])
		.filter(s => s.length <= 30 && /^[\p{L}\s&'-]+$/u.test(s))
		.slice(0, 5);
}

function clean(text: string): string {
	// Strip Open Library's trailing source citations and collapse whitespace.
	return text
		.replace(/\(\[source\]\[\d+\]\)/gi, "")
		.replace(/-{3,}.*$/s, "")
		.replace(/\s+/g, " ")
		.trim();
}
