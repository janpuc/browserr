const TMDB_IMG = "https://image.tmdb.org/t/p";

export type ImageKind = "poster" | "backdrop" | "logo" | "profile";

const SIZES: Record<ImageKind, string> = {
  poster: "w500",
  backdrop: "w1280",
  logo: "w500",
  profile: "w185",
};

export function tmdbImage(
  path: string | null | undefined,
  kind: ImageKind = "poster",
  size?: string,
): string | null {
  if (!path) return null;
  return `${TMDB_IMG}/${size ?? SIZES[kind]}${path}`;
}

/** Small blurred placeholder source for blur-up loading. */
export function tmdbBlur(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${TMDB_IMG}/w92${path}`;
}

export function youtubeThumb(key: string): string {
  return `https://i.ytimg.com/vi/${key}/hqdefault.jpg`;
}
