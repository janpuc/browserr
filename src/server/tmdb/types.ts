import "server-only";

/** Minimal raw TMDB shapes - only the fields Browserr consumes. */

export interface TmdbRegion {
  iso_3166_1: string;
  english_name: string;
  native_name?: string;
}

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface TmdbMediaResult {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  original_language?: string;
}

export interface TmdbPaginated<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  name: string;
  official: boolean;
  published_at?: string;
  size?: number;
}

export interface TmdbImage {
  file_path: string;
  iso_639_1: string | null;
  vote_average?: number;
  width?: number;
  height?: number;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  order?: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path: string | null;
}

export interface TmdbWatchProviderEntry {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
}

export interface TmdbSeason {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
}

export interface TmdbDetail extends TmdbMediaResult {
  genres?: { id: number; name: string }[];
  tagline?: string;
  runtime?: number;
  episode_run_time?: number[];
  status?: string;
  number_of_seasons?: number;
  seasons?: TmdbSeason[];
  videos?: { results: TmdbVideo[] };
  images?: { logos?: TmdbImage[]; backdrops?: TmdbImage[]; posters?: TmdbImage[] };
  credits?: { cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] };
  keywords?: { keywords?: { id: number; name: string }[]; results?: { id: number; name: string }[] };
  recommendations?: TmdbPaginated<TmdbMediaResult>;
  similar?: TmdbPaginated<TmdbMediaResult>;
  "watch/providers"?: { results?: Record<string, TmdbWatchProviderEntry> };
  release_dates?: {
    results: { iso_3166_1: string; release_dates: { certification: string }[] }[];
  };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
}

export interface TmdbGenre {
  id: number;
  name: string;
}
