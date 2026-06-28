# Contributing to Browserr

Thanks for helping out! This guide covers local setup, the branch model, and how
releases work.

## Local setup

```bash
npm install
cp .env.example .env      # at minimum set TMDB_API_KEY
npm run dev               # http://localhost:3000
```

Before opening a PR:

```bash
npm run typecheck         # tsc --noEmit (strict)
npm test                  # Vitest unit tests
npm run build             # production build must pass
```

There is no ESLint config; **strict `tsc` + `npm test` are the gate** (the same
checks CI runs). Match the surrounding style: server-only code stays under
`src/server/**`, client-safe types/utilities under `src/lib/**`, and **secrets and
the Seerr internal URL never reach the client** - the latter is locked down by a
test in `src/lib/config.test.ts`, so add coverage there if you touch
`toPublicConfig`.

## Branch model (GitHub Flow)

We keep it simple - trunk-based development:

- **`main`** is always releasable and protected. No direct pushes.
- Branch off `main` for every change: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Open a PR into `main`. CI (`typecheck` + `test` + `build` + demo export) must be
  green; squash-merge to keep history linear.

Suggested branch protection for `main`:

- Require a pull request before merging.
- Require status checks to pass (`CI / Typecheck & build`).
- Require branches to be up to date before merging.
- Disallow force pushes and deletions.

> A long-lived `develop` branch (git-flow) is intentionally **not** used - it's
> overhead this project doesn't need. If you ever want a public pre-release lane,
> add a `next` branch that publishes a `:next` image tag, rather than git-flow.

## Versioning & releases

Releases are automated by [Release Please](https://github.com/googleapis/release-please)
and follow [Semantic Versioning](https://semver.org). You never bump `package.json`
or push a tag by hand - merge Conventional-Commit PRs into `main`, and a
`chore(main): release X.Y.Z` PR accumulates the version bump and changelog. Merging
**that** PR tags the release, publishes the GitHub Release, and builds the versioned
image. Every push to `main` also publishes a moving **`:edge`** image for testers.

Full details and the one-time repo setup are in **[docs/RELEASING.md](docs/RELEASING.md)**.

## The public demo

`npm run build:demo` produces a static, keyless export in `out/` (deployed to
GitHub Pages by the **Deploy demo** workflow). It runs entirely on bundled JSON
fixtures under `public/demo/` - no TMDB key, no Seerr, no database. Requests and
settings are disabled there.

Regenerate fixtures from a running dev server (one with a real TMDB key):

```bash
npm run demo:fixtures     # snapshots /api/home + top titles into public/demo/
```

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org) - they drive
automated versioning and the changelog (see
[docs/RELEASING.md](docs/RELEASING.md)). The type that lands on `main` (after a
squash-merge, the **PR title**) is what counts:

- `feat:` a user-facing capability - `fix:` a bug fix - `feat!:` / `BREAKING CHANGE:`
  an incompatible change.
- `docs:` `refactor:` `perf:` `test:` `chore:` `ci:` `build:` don't trigger a
  release on their own.

Keep them imperative and scoped.

## Reporting security issues

Please report vulnerabilities privately via a
[GitHub Security Advisory](https://github.com/janpuc/browserr/security/advisories/new),
not a public issue.
