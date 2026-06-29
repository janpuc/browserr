# Browserr install counter (Cloudflare Worker)

A tiny, free Worker that powers the **`installs`** badge on the main README.

Each Browserr instance sends one anonymous heartbeat per day with a random
per-instance UUID plus **non-PII deployment facts** (version, runtime -
node/docker/kubernetes -, platform, arch, node version, auth/request mode, region,
and whether Seerr is configured). The Worker stores one KV key per instance with a
35-day TTL (facts in the key metadata), so the count reflects roughly the last
month of *active* installs - not an ever-growing all-time number.

No IP, URLs, keys, user, or library data is ever sent or stored.

## Deploy

```bash
cd telemetry
npm install
npx wrangler login
npx wrangler kv namespace create INSTALLS   # paste the printed id into wrangler.toml
npx wrangler secret put STATS_PASS          # password that locks /stats + /dashboard
npx wrangler deploy
```

You'll get a URL like `https://browserr-telemetry.<you>.workers.dev`.

## Wire it up

1. **Point instances at it.** Set `DEFAULT_TELEMETRY_URL` in
   [`../src/lib/config.ts`](../src/lib/config.ts) to
   `https://browserr-telemetry.<you>.workers.dev/ping` so every deployment reports
   in by default. (Individual deployers can override with `TELEMETRY_URL` or opt
   out with `BROWSERR_TELEMETRY=false`.)
2. **Add the badge.** In the root README, replace `YOUR-SUBDOMAIN` in the
   `installs` badge with your `workers.dev` subdomain (or custom domain).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/ping` | heartbeat `{ id, version, runtime, … }`; `id` must be a UUID, body capped at 4 KB, fields validated/length-capped |
| `GET` | `/badge` | shields.io endpoint JSON -> `installs | N` |
| `GET` | `/stats` | 🔒 aggregate JSON (`total`, `byVersion`, `byRuntime`, `byRegion`, `byPlatform`, `byNode`, `byAuthMode`, `byRequestMode`, `seerrConfigured`); **no per-instance data**. Basic auth (`STATS_PASS`). |
| `GET` | `/dashboard` | 🔒 self-contained HTML charts of `/stats`. Basic auth (`STATS_PASS`). |

## Visualize it

The quickest option is built in - open
**`https://browserr-telemetry.<you>.workers.dev/dashboard`** (your browser prompts
for the Basic-auth credentials) for a one-page set of charts (total, version split,
runtime node/docker/k8s, region, platform, node version, auth/request mode).

`/stats` is JSON behind the same credentials, so you can pull it anywhere:

```bash
curl -s -u admin:YOUR_STATS_PASS https://browserr-telemetry.<you>.workers.dev/stats | jq
```

- a Grafana **Infinity** / **JSON API** datasource (with Basic auth) on `/stats`,
- an Observable / Datasette notebook,
- a scheduled GitHub Action that fetches `/stats` and commits a chart to the repo.

## Notes

- **Privacy:** only a random id + the non-PII facts the instance chooses to send
  are stored (no IP, user, or content data). Inactive instances expire via the KV
  TTL. `/stats` only ever returns aggregate counts.
- **Abuse:** `/ping` validates the UUID, caps the body to 4 KB, and length-caps /
  enum-validates every stored field, so garbage can't bloat the KV metadata. The
  count is a best-effort vanity metric (Cloudflare handles volumetric abuse).
- **Counting** lists KV keys, which is eventually consistent and fine here. If you
  ever need exactness at scale, move the tally into a Durable Object or an
  aggregate counter.
