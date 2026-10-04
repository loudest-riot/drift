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

## Frontend source of truth

Edit `public/index.html`, `public/app.js`, and `public/styles.css` directly.
Do not add root-level frontend copies or UI patch scripts. Shared service logic
is included in `public/app.js`; backend/API logic stays in `src/index.js`.
For a new frontend release, update the asset query version in all HTML pages
and the cache name/CORE URLs in `public/sw.js` together.
The HTML `data-release` attribute identifies the deployed frontend release.
Before changing Cloudflare settings, verify the custom domain's Worker binding;
GitHub currently reports builds for both `drift` and `loudest-riot-drift-git`.

## Trail data

`public/data/hines-trails.json` bundles WGS84 line geometry from Wayne County ParkFinder Trails and a curated MCMBA collection. It is reference geometry, not live trail conditions. Access directions use published addresses; no parking coordinates are guessed. Favorites use a separate device-local key and preserve existing intercepts and walks.

## Branding

The app header uses the DRIFT wordmark with the expansion **Distributed Relays In Field Terrain** and the Loudest Riot Sounds imprint.
