# Configuration

Browserr resolves its configuration from three layers.

**Precedence (lowest -> highest):** built-in defaults -> **environment variables**
-> **GUI settings** (persisted in SQLite). The GUI overrides env.

Setting `LOCK_CONFIG=true` freezes configuration to the env values and makes the
in-app Settings screen read-only - use it for locked-down deployments.

Almost everything is editable in the **Settings** screen: connections (TMDB,
Seerr), region, services, feature toggles, and appearance. `DATABASE_URL` and
`REDIS_URL` are env-only (they're needed to reach the database itself).

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `PUBLIC_URL` | `http://localhost:3000` | External URL of Browserr itself |
| `TZ` | `UTC` | Timezone |
| `LOCK_CONFIG` | `false` | `true` -> env is authoritative, GUI read-only |
| `TMDB_API_KEY` | - | TMDB v3 key (or...) |
| `TMDB_ACCESS_TOKEN` | - | ...TMDB v4 bearer token |
| `TMDB_LANGUAGE` | `en-US` | Drives metadata language + title logos |
| `SEERR_INTERNAL_URL` | - | **Server-to-server** base (e.g. `http://seerr:5055`). Never sent to the client. |
| `SEERR_EXTERNAL_URL` | - | **Browser redirect** base (your public Seerr URL) |
| `SEERR_API_KEY` | - | `X-Api-Key` for Seerr |
| `SEERR_REQUEST_MODE` | `redirect` | `redirect` \| `proxy` |
| `DEFAULT_REGION` | `US` | ISO 3166-1 alpha-2 |
| `DEFAULT_SERVICES` | _(all)_ | CSV of TMDB provider IDs, e.g. `8,9,337` |
| `MONETIZATION_TYPES` | `flatrate` | CSV of `flatrate,free,ads,rent,buy` |
| `AUTH_MODE` | `none` | `none` \| `seerr` \| `basic` |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | - | Used when `AUTH_MODE=basic` |
| `DATABASE_URL` | `sqlite://./data/browserr.db` | `sqlite://...` path (env-only) |
| `REDIS_URL` | - | Optional (an in-memory LRU cache is the default) |
| `ENABLE_RECOMMENDATIONS` | `true` | Self-learning rails |
| `ENABLE_EMBEDDINGS` | `false` | Reserved for optional semantic recs |
| `RECS_REFRESH_CRON` | `0 */6 * * *` | Refresh cadence (hour-interval honored) |
| `ENABLE_LIBRARY_RAILS` | `true` | "Available now in your library" rails |
| `HERO_ROTATE_SECONDS` | `12` | Hero billboard rotation |

## The internal / external Seerr split (mandatory)

`SEERR_INTERNAL_URL` is used by Browserr's **server** for all `/api/v1` calls
(availability lookups, proxied requests) - typically a Docker-network address.
`SEERR_EXTERNAL_URL` is used **only** to build links the user's **browser** opens.

The internal URL is never exposed to the client: `/api/config` omits it entirely,
and the Settings form treats it as a write-only field. Keeping these separate is
what lets the server reach Seerr over a private network while the browser still
gets a working public deep link.

## How region & service selection works

1. The region picker is populated from TMDB `GET /watch/providers/regions`.
2. For the selected region, Browserr fetches movie + TV watch providers and shows
   the **union (deduped by `provider_id`, ordered by `display_priority`)** - and
   nothing else.
3. You multi-select the services you subscribe to (or "All"). These are stored as
   TMDB provider IDs and are always **intersected with what's actually available
   in the region**, so a stale ID can never leak into queries.
4. Per-service and genre rails use TMDB `discover` with `watch_region`,
   `with_watch_providers`, and `with_watch_monetization_types`.

Changing the region re-derives the service list and the whole catalog.
