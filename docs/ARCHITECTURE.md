# Architecture

**Stack:** Next.js (App Router) - React - TypeScript - Tailwind - Framer Motion -
TanStack Query - Drizzle ORM on libsql (SQLite). Native-scroll rails for
trackpad/touch. TMDB + Seerr secrets stay server-side; the browser only ever
talks to the BFF.

```
src/
  app/                    Next.js App Router
    api/                  BFF route handlers (proxy/normalize TMDB + Seerr, hide secrets)
    layout.tsx page.tsx   server shell (+ starts the cron worker)
    settings/             Settings screen
  components/             Hero, Rail, MediaCard, DetailModal, Navbar, Settings... (+ providers)
  lib/                    client-safe types, config schema, api client, image/availability utils
  server/
    config.ts env.ts      config precedence (defaults -> env -> DB) + LOCK_CONFIG
    db/                   libsql + Drizzle schema (idempotent migrate on boot)
    tmdb/ seerr/          upstream clients (cached, retrying, resilient)
    recommend/            features, taste profile, scoring engine, signal capture
    rails/                home-feed composition
    region.ts cron.ts     region/service engine + background refresher
```

## BFF API

The browser never calls TMDB or Seerr directly - every request goes through these
same-origin route handlers, which attach secrets server-side and normalize the
responses.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness + configured flags |
| `GET`/`PUT` | `/api/config` | Public config / save settings |
| `GET` | `/api/regions` | TMDB regions |
| `GET` | `/api/services?region=` | Services available in a region |
| `GET` | `/api/home` | Composed hero + rails |
| `GET` | `/api/rails?page=` | Additional rails for infinite scroll |
| `GET` | `/api/title/:type/:id` | Detail + availability + redirect URL |
| `POST` | `/api/availability` | Batch Seerr availability (badge hydration) |
| `POST` | `/api/request` | Redirect or proxy a request |
| `POST` | `/api/signals` | Capture an interaction |
| `GET` | `/api/recommendations/explain` | "Why am I seeing this?" |
| `POST` | `/api/recommendations/reset` | Forget taste profile |
| `GET` | `/api/search?q=` | Multi-search |
| `POST` | `/api/connection-test` | Test TMDB/Seerr credentials |

## Recommendations

The available library is itself the primary taste signal, refined by interactions:

- **Signals** (weighted, time-decayed): request / watchlist / watched (positive),
  detail-open (weak positive), not-interested / hide (negative).
- **Profile**: a sparse feature vector built from each title's TMDB metadata
  (genres, keywords, top cast, director/creator, language, decade, runtime). The
  per-user profile is a time-decayed aggregate of positive-signal vectors minus
  negatives.
- **Scoring**: cosine similarity to the profile, blended with a popularity/quality
  prior and an **availability boost** (titles on your services / in your library),
  with greedy diversity so rails aren't monotonous.
- **"Because you watched X"**: TMDB recommendations + similar for a recent
  strong-signal title, re-ranked by local feature similarity.
- **Cold start**: seeded from your Seerr library composition (or popular-in-region
  if Seerr isn't connected).
- **Transparency**: every title has a "Why am I seeing this?" explainer; Settings
  has a "Reset taste profile" control.

## Security & resilience

- All TMDB/Seerr secrets and the Seerr **internal URL** stay server-side. The
  client only ever receives a `PublicConfig` projection (enforced by
  `toPublicConfig`, covered by a regression test).
- Mutations are same-origin guarded (CSRF) and rate-limited; the external redirect
  URL is sanitized.
- If Seerr is unreachable the catalog still browses and badges show "Unknown";
  TMDB calls retry with backoff and serve stale-on-error from cache.

## Out of scope (v1)

Direct playback (Browserr discovers and hands off), writing watch history back to
media servers, native mobile apps (PWA-ready), and household blended profiles.
