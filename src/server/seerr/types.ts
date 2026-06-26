import "server-only";

export interface SeerrSeasonInfo {
  seasonNumber: number;
  status: number;
}

export interface SeerrMediaInfo {
  id?: number;
  tmdbId?: number;
  status?: number;
  status4k?: number;
  mediaType?: "movie" | "tv";
  seasons?: SeerrSeasonInfo[];
}

export interface SeerrTitleResponse {
  id?: number;
  mediaInfo?: SeerrMediaInfo | null;
}

export interface SeerrMediaListItem {
  id: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  status: number;
}

export interface SeerrMediaListResponse {
  pageInfo?: { results: number; page: number; pages: number };
  results: SeerrMediaListItem[];
}

export interface SeerrRequestBody {
  mediaType: "movie" | "tv";
  mediaId: number;
  seasons?: number[] | "all";
  is4k?: boolean;
}

export interface SeerrStatus {
  version?: string;
  commitTag?: string;
}

export interface SeerrWatchlistItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title?: string;
}

export interface SeerrWatchlistResponse {
  results: SeerrWatchlistItem[];
}
