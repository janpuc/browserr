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
npm run typecheck         # tsc --noEmit
npm run build             # production build must pass
```

There is no ESLint config; **`tsc` (strict) is the gate**. Match the surrounding
style: server-only code stays under `src/server/**`, client-safe types/utilities
under `src/lib/**`, and **secrets and the Seerr internal URL never reach the
client**.

## Branch model (GitHub Flow)

We keep it simple - trunk-based development:

- **`main`** is always releasable and protected. No direct pushes.
- Branch off `main` for every change: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Open a PR into `main`. CI (`typecheck` + `build` + demo export) must be green;
  squash-merge to keep history linear.

Suggested branch protection for `main`:

- Require a pull request before merging.
- Require status checks to pass (`CI / Typecheck & build`).
- Require branches to be up to date before merging.
- Disallow force pushes and deletions.

> A long-lived `develop` branch (git-flow) is intentionally **not** used - it's
> overhead this project doesn't need. If you ever want a public pre-release lane,
> add a `next` branch that publishes a `:next` image tag, rather than git-flow.

## Versioning & releases (SemVer)

Versions follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

`package.json` `version` is the source of truth, surfaced in the app via
`BROWSERR_VERSION` (CI injects the git tag; falls back to `package.json`).

To cut a release:

1. Bump `version` in `package.json` on a PR; merge to `main`.
2. Tag the merge commit and push:
   ```bash
   git tag v1.2.3 && git push origin v1.2.3
   ```
3. The **Publish image** workflow builds a multi-arch image and pushes:
   - `ghcr.io/janpuc/browserr:1.2.3`, `:1.2`, and `:latest`.
4. Every push to `main` also publishes a moving **`:edge`** image for early testers.

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

Conventional-ish prefixes are appreciated (`feat:`, `fix:`, `docs:`, `chore:`,
`refactor:`) but not enforced. Keep them imperative and scoped.

## Reporting security issues

Please report vulnerabilities privately via a
[GitHub Security Advisory](https://github.com/janpuc/browserr/security/advisories/new),
not a public issue.
