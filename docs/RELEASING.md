# Releasing

Releases are **almost hands-off**. You write Conventional Commits; automation does
the versioning, changelog, tagging, GitHub Release, and image publishing. The only
human action is **merging the release PR** when you're ready to ship.

## TL;DR

1. Merge normal PRs into `main` using [Conventional Commits](#commit-conventions).
2. [Release Please](https://github.com/googleapis/release-please) keeps a
   **`chore(main): release X.Y.Z` PR** open, continuously updating the version
   bump and `CHANGELOG.md` from those commits.
3. **Merge that PR** when you want to release. That single action:
   - tags `vX.Y.Z` and publishes the **GitHub Release** with generated notes;
   - triggers the multi-arch image build -> `ghcr.io/janpuc/browserr:X.Y.Z`,
     `:X.Y`, `:X`, `:latest`.
4. The demo on GitHub Pages redeploys from `main` automatically.

You never bump `package.json`, write the changelog, or push a tag by hand.

## The pipeline

| Workflow | Trigger | Does |
|---|---|---|
| **CI** (`ci.yml`) | every PR + push to `main` | typecheck -> **test** -> build -> demo export. The required status check. |
| **Release** (`release.yml`) | push to `main` | runs Release Please, then builds the multi-arch image **once**: always `:edge` + `:sha-<short>`, and when a release PR merges the same build also gets `:X.Y.Z` / `:X.Y` / `:X` / `:latest`. |
| **Deploy demo** (`pages.yml`) | push to `main` | static, keyless demo to GitHub Pages. |

### Why edge + release share one workflow

Two reasons. First, GitHub deliberately **does not** let the `GITHUB_TOKEN`-created
release tag re-trigger other workflows (it would recurse), so a separate "build on
tag push" job would silently never run - building in the same workflow as
release-please sidesteps that, no PAT needed. Second, a release PR merge is just a
push to `main`, so a separate edge workflow would fire **at the same time** and
rebuild the identical image twice. Folding both into one `image` job builds it
**once** and adds the version tags only when `release_created == 'true'`.

## Commit conventions

Release Please reads commit **types** to decide the next version and to group the
changelog. Pre-1.0 (`0.x`), bumps are conservative:

| Commit | Example | Version effect (0.x) |
|---|---|---|
| `fix:` | `fix: stop modal overflowing on mobile` | patch (`0.1.0` -> `0.1.1`) |
| `feat:` | `feat: add watchlist rail` | patch (`0.1.0` -> `0.1.1`) |
| `feat!:` / `BREAKING CHANGE:` | `feat!: drop legacy config keys` | minor (`0.1.0` -> `0.2.0`) |
| `docs:` `refactor:` `perf:` `test:` `chore:` `ci:` `build:` | - | no release on their own |

After `1.0.0`, `feat:` bumps minor and breaking changes bump major, per
[SemVer](https://semver.org). The pre-1.0 behavior is configured in
`release-please-config.json` (`bump-minor-pre-major`, `bump-patch-for-minor-pre-major`).

`package.json` `version` is the source of truth, surfaced in the app via
`BROWSERR_VERSION` (CI injects the release version; `:edge` images get
`edge-<sha>`; otherwise it falls back to `package.json`).

## Image tags

| Tag | Meaning |
|---|---|
| `:X.Y.Z` | exact release |
| `:X.Y`, `:X` | latest patch / minor within that line |
| `:latest` | newest release |
| `:edge` | tip of `main` (rebuilt every push) |
| `:sha-<short>` | a specific `main` commit |

Pin `:X.Y.Z` (or at least `:X.Y`) in production; use `:edge` only for testing.

## One-time repository setup

- **Pages:** Settings -> Pages -> Source = "GitHub Actions" (enables the demo deploy).
- **Actions permissions:** Settings -> Actions -> General -> Workflow permissions ->
  "Read and write permissions", and check **"Allow GitHub Actions to create and
  approve pull requests"** (Release Please opens the release PR).
- **Package visibility:** after the first image publishes, set the GHCR package to
  public if you want anonymous `docker pull`.
- **Branch protection** for `main`: require a PR, require the **`CI / Typecheck &
  build`** check, disallow force pushes/deletions.

## Manual / fallback paths

- **Actions -> Release -> Run workflow** (`workflow_dispatch`) re-runs the release
  check and rebuilds the `:edge` image (and publishes the release image too if a
  release was just created).
- A hotfix is just a `fix:` commit on `main`; merge the resulting release PR.
