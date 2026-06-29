# Browserr

[![CI](https://github.com/janpuc/browserr/actions/workflows/ci.yml/badge.svg)](https://github.com/janpuc/browserr/actions/workflows/ci.yml)
[![Release](https://github.com/janpuc/browserr/actions/workflows/release.yml/badge.svg)](https://github.com/janpuc/browserr/actions/workflows/release.yml)
[![Deploy demo](https://github.com/janpuc/browserr/actions/workflows/pages.yml/badge.svg)](https://github.com/janpuc/browserr/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![ghcr.io](https://img.shields.io/badge/ghcr.io-janpuc%2Fbrowserr-2496ED?logo=docker&logoColor=white)](https://github.com/janpuc/browserr/pkgs/container/browserr)
[![Installs](https://img.shields.io/endpoint?url=https%3A%2F%2Fbrowserr-telemetry.janpuc.workers.dev%2Fbadge)](https://github.com/janpuc/browserr)

**A self-hosted, Netflix-style discovery front-end for your media stack.**

> ### ▶️ [**Live demo →**](https://janpuc.github.io/browserr/)
> A keyless, read-only tour running on static fixtures - no TMDB key, no database, no requests.

Browserr turns _"what can I watch?"_ into a cinematic browse experience - rotating hero
billboards, genre and per-service rails, and "Because you watched…" recommendations across
every streaming service available in your region. When you find something you don't have yet,
it hands off to **[Seerr](https://github.com/seerr-team/seerr)** for live "what's in my
library" status and one-click requests.

The name follows the `*arr`/Seerr convention: a **browser** for everything you can stream.

## Screenshots

> Try the **[live demo](https://janpuc.github.io/browserr/)**, or regenerate these locally with
> `npm run build:demo && npm run screenshots`.

![Browserr home](docs/screenshots/home.png)

| Title detail | Settings |
|---|---|
| ![Detail modal](docs/screenshots/detail.png) | ![Settings](docs/screenshots/settings.png) |

## Features

- **Netflix-style home** - a full-bleed rotating hero, lazy horizontally-scrolling rails, and a
  rich detail view with trailer, cast, seasons, and where-to-watch.
- **Region & service aware** - only ever shows streaming services TMDB lists for your region.
  Change region and the whole catalog and service list re-derive.
- **Seerr integration** - every title shows live library availability; request via redirect
  (open Seerr) or proxy (submit on your behalf).
- **Self-learning recommendations** - a taste profile that seeds from your library and shifts
  as you browse, with "Because you watched X" rails and a "Why am I seeing this?" explainer.
- **Configure however you like** - env vars seed defaults; the in-app Settings screen overrides
  them. No secrets or internal URLs ever reach the browser.
- **One Docker image** - drops into an existing `*arr`/Seerr stack via `docker-compose`.
- **Accessible & responsive** - keyboard/remote navigable, reduced-motion honored, dark-first
  theming. Works desktop -> tablet -> mobile -> 10-foot TV.

## Quick start

### With Docker Compose (recommended)

```bash
cp .env.example .env
# edit .env: add TMDB_API_KEY, SEERR_API_KEY, SEERR_EXTERNAL_URL, DEFAULT_REGION…
docker compose up -d
```

Open <http://localhost:3000>. The bundled `docker-compose.yml` also starts Seerr and wires
Browserr to it on the Docker network (`SEERR_INTERNAL_URL=http://seerr:5055`).

Prefer the **prebuilt multi-arch image** over building locally:

```yaml
# docker-compose.yml
services:
  browserr:
    image: ghcr.io/janpuc/browserr:latest   # or pin a release, e.g. :1.0.0  (:edge = latest main)
```

You only need a [TMDB API key](https://www.themoviedb.org/settings/api) to start browsing.
Seerr is optional - without it the catalog still browses and availability badges show "Unknown".

### Run from source

```bash
npm install
cp .env.example .env      # at minimum set TMDB_API_KEY
npm run dev               # http://localhost:3000
```

## Configuration

**Precedence (lowest -> highest):** built-in defaults -> **environment variables** ->
**GUI settings**. The in-app **Settings** screen edits connections, region, services, feature
toggles, and appearance; set `LOCK_CONFIG=true` to freeze everything to env and make the GUI
read-only.

> ⚠️ Seerr uses a **separate internal URL** for server-to-server calls and **external URL** for
> browser redirects. The internal URL never reaches the client.

The full environment-variable reference lives in **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)**.

## Documentation

- **[Configuration](docs/CONFIGURATION.md)** - every env var, the Seerr internal/external split,
  and how region & service selection works.
- **[Architecture](docs/ARCHITECTURE.md)** - the stack, source layout, BFF API, recommendations
  engine, and security model.
- **[Releasing](docs/RELEASING.md)** - the hands-off release pipeline and image tags.
- **[Contributing](CONTRIBUTING.md)** - local setup, branch model, and the test gate.

## Contributing

PRs welcome! The gate is `npm run typecheck` + `npm test` + `npm run build`. See
**[CONTRIBUTING.md](./CONTRIBUTING.md)**. Please report security issues privately via a
[security advisory](https://github.com/janpuc/browserr/security/advisories/new).

## Star history

<a href="https://star-history.com/#janpuc/browserr&Date">
  <img src="https://api.star-history.com/svg?repos=janpuc/browserr&type=Date" alt="Star history chart" width="600" />
</a>

## License

[MIT](./LICENSE) © Jan Puciłowski.
