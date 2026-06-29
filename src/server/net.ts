import "server-only";

/** Thrown when a server-side fetch target is refused (SSRF guard). */
export class UpstreamUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamUrlError";
  }
}

/**
 * SSRF guard for the user-supplied Seerr URL: block cloud-metadata / link-local
 * and non-http(s) schemes; private LAN ranges stay allowed (Seerr lives there).
 * DNS rebinding is a residual - see SECURITY.md. Leaf module so http/config/seerr
 * can use it cycle-free.
 */
export function assertSafeUpstreamUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UpstreamUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UpstreamUrlError("Only http and https URLs are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const blocked =
    host === "metadata.google.internal" ||
    host === "100.100.100.200" ||
    host.startsWith("169.254.") ||
    host === "fd00:ec2::254" ||
    host.startsWith("fe80:");
  if (blocked) {
    throw new UpstreamUrlError("Refusing to connect to a link-local or cloud-metadata address");
  }
}
