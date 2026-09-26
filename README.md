# DRIFT // Loudest Riot Sounds

DRIFT = Distributed Relays In Field Terrain.

This repository deploys the DRIFT mobile web app to the existing Cloudflare Worker named `drift`.

## Cloudflare Builds

- Worker name: `drift`
- Build command: leave blank unless Cloudflare requests one
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Production branch: `main`

Static app files live in `public/`.
