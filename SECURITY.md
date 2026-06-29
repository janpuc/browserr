# Security policy

## Reporting a vulnerability

Please report security issues **privately** via a
[GitHub Security Advisory](https://github.com/janpuc/browserr/security/advisories/new),
not a public issue. Include the version (Settings footer) and steps to reproduce.

## Threat model

Browserr is a self-hosted BFF that holds TMDB/Seerr credentials server-side and
brokers requests for a small, trusted set of users (a homelab). It is **not**
designed to be a public, multi-tenant service exposed raw to the internet.

- **Secrets stay server-side.** TMDB/Seerr API keys and the **internal Seerr URL**
  are never sent to the browser - the client only ever gets a `PublicConfig`
  projection (enforced by `toPublicConfig`, covered by a test). The diagnostics
  export redacts them too.
- **Mutations are same-origin guarded** (a lightweight CSRF check) and
  **rate-limited** per client.
- **SSRF is bounded.** The Seerr connection tester / availability lookups fetch a
  user/admin-supplied URL; every Seerr call refuses **cloud-metadata and
  link-local** targets (`169.254.0.0/16`, `metadata.google.internal`, IPv6
  link-local, …) and non-`http(s)` schemes (`assertSafeUpstreamUrl`, with a test).
  Private LAN ranges stay allowed on purpose (Seerr usually lives at
  `http://seerr:5055`). **Residual:** DNS rebinding to a metadata IP is still
  possible, so keep config writes behind auth on exposed deployments (below).

## What you should configure for an exposed deployment

By default (`AUTH_MODE=none`) the **Settings screen, config save, and connection
test are unauthenticated** - fine on a trusted LAN, risky if reachable from the
internet. If anyone untrusted can reach the app:

1. **Authenticate it.** Set `AUTH_MODE=basic` (HTTP Basic, constant-time compare)
   or `AUTH_MODE=seerr`, **or** put it behind an authenticating reverse proxy /
   VPN / Tailscale.
2. **Freeze config** with `LOCK_CONFIG=true` so the GUI is read-only and settings
   can only change via env.
3. **Front it with a reverse proxy** that:
   - terminates **TLS** and sets **HSTS** (the app doesn't, so it still works over
     plain HTTP on a LAN);
   - sets a correct **`X-Forwarded-For`** (the rate limiter keys on it - without a
     trusted proxy it can be spoofed to evade limits);
   - optionally adds **`X-Frame-Options: SAMEORIGIN`** / `Content-Security-Policy:
     frame-ancestors` if you are *not* embedding Browserr in a dashboard iframe
     (clickjacking protection is left off by default because homelab dashboards
     commonly embed it).

## Telemetry

The anonymous install heartbeat is **opt-out** (`BROWSERR_TELEMETRY=false`) and
sends only non-PII deployment facts (version, runtime, platform, which features
are on, region) - no IP, URLs, keys, user, or library data. See
[docs/CONFIGURATION.md](docs/CONFIGURATION.md#telemetry--privacy).

## Supported versions

Security fixes target the latest release. Pin a specific `:X.Y.Z` image in
production and update regularly (Renovate keeps dependencies current).
