# Media API — Cloudflare Workers

Serverless media API running on **Cloudflare Workers** with native **R2 bindings** and **Turso** (libSQL over HTTP).

## Features

- Upload images/videos → streamed to R2 (native binding, no S3 SDK)
- Metadata in Turso (global low-latency SQLite)
- Filter by country, type, free-text search + pagination
- Response shape: `{ id, title, description, country, media: {...}, createdAt }`
- CORS, logger, optional API-key auth
- Zero cold-start, runs at the edge worldwide

## Setup

```bash
bun install        # or npm install
wrangler login
wrangler r2 bucket create media-bucket
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put API_KEY   # optional
```

Edit `wrangler.toml` → set your `TURSO_DATABASE_URL` and `bucket_name`.

Create the table via `turso shell`:
```bash
turso db shell <db-name> < schema.sql
```

## Run

```bash
bun run dev       # wrangler dev
bun run deploy    # wrangler deploy
```

## Upload example

```bash
curl -X POST https://media-api.you.workers.dev/api/media \
  -H "x-api-key: $API_KEY" \
  -F "file=@sunset.mp4" \
  -F "title=Sunset in Lisbon" \
  -F "description=Golden hour" \
  -F "country=Portugal"
```

## Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Sunset in Lisbon",
    "description": "Golden hour",
    "country": "Portugal",
    "media": {
      "url": "https://media.yourdomain.com/video/2026-09-10/uuid.mp4",
      "type": "video",
      "mimeType": "video/mp4",
      "size": 12345678,
      "duration": 42.5
    },
    "createdAt": "2026-09-10T12:00:00.000Z"
  }
}
```

## Limits

- Workers request body: **100 MB (free) / 500 MB (paid)**. For larger videos, switch to direct-to-R2 uploads using presigned URLs (add a `POST /api/media/presign` endpoint that returns an R2 PUT URL).
- R2 egress is free — serve media straight from the bucket.

## Expose media publicly

Two options:
1. **Public R2 bucket** → set `PUBLIC_MEDIA_URL` in `wrangler.toml` to the dev URL or a custom domain.
2. **Custom domain** → in Cloudflare dashboard, attach a domain to the R2 bucket.

## Why this is fast

- **Native R2 binding** — no HTTP hop to S3, no AWS SDK, no signature math.
- **Turso over HTTP** — single `fetch` call, cached client per isolate.
- **Edge execution** — code runs in 300+ cities.
