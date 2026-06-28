# Browserr install counter (Cloudflare Worker)

A tiny, free Worker that powers the **`installs`** badge on the main README.

Each Browserr instance sends one anonymous heartbeat per day (`{ id, version }`,
where `id` is a random per-instance UUID). The Worker stores one KV key per
instance with a 35-day TTL, so the count reflects roughly the last month of
*active* installs - not an ever-growing all-time number.

## Deploy

```bash
cd telemetry
npm install
npx wrangler login
npx wrangler kv namespace create INSTALLS   # paste the printed id into wrangler.toml
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
| `POST` | `/ping` | `{ id, version }` heartbeat; `id` must be a UUID |
| `GET` | `/badge` | shields.io endpoint JSON -> `installs | N` |
| `GET` | `/stats` | `{ total, byVersion }` for charting adoption per release |

## Notes

- **Privacy:** no IP, user, or content data is stored - only a random id + the
  version string, both supplied by the instance. Inactive instances expire via
  the KV TTL.
- **Counting** lists KV keys, which is eventually consistent and fine for a
  vanity counter. If you ever need exactness at scale, move the tally into a
  Durable Object or an aggregate counter.
