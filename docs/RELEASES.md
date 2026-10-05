# DRIFT Release / Field Log

DRIFT is a location-based psychogeography and psychogeocaching PWA by Loudest Riot Sounds.

## v0.18 — CLEAR FIRST STEPS
- Opening guide defines a drift, explains why to explore, and gives three concrete first steps.
- Navigation uses MAP, TRAILS, SAVED, and ABOUT; route and find actions describe what they do.
- Shared action sizes, corner radii, focus states, and disabled states standardize controls.
- Asset URLs and service-worker cache advance together to v18.

## v0.17 — ENTER THE FIELD
- Quick Start and ENTER THE FIELD appear on every fresh app opening, including returning visitors.
- Entering the field does not require browser storage or request location permission.
- Asset URLs and the service-worker cache advance together to v17.

## v0.16 — TRAILS + PSYCHOGEOCACHING
- MINIMAL has no street tiles or permanent labels; county trail lines are the default map content. STANDARD adds OpenStreetMap.
- Optional signal, landmark, city, MTB, and paved overlays live in a collapsed control.
- TRAILS collection includes Hines MTB routes and source-backed access addresses, with device-local favorites and Apple Maps directions.
- Bundled Wayne County route geometry (retrieved October 4, 2026) works offline. Routes absent from the county dataset link to MCMBA's guide instead of guessed lines or pins.
- A standalone Features page is linked from INFO and Quick Start.
- INFO and Quick Start explain DRIFT psychogeocaches and their relationship to psychogeography and geocaching, with foundation links.
- Service worker v16 includes the trail dataset, fetched network-first like app code.

## v0.15 — STABILIZED FIELD
- `public/` is the only deployed frontend source; root UI duplicates and patch files are retired.
- One app script and one stylesheet, including shared-service behavior.
- MINIMAL grayscale OpenStreetMap on every fresh page load, with an optional full-color STANDARD switch; no basemap API key is required.
- Static, visually matched HINES and HINES PLACES controls.
- No permanent signal-card carousel. Location details appear only on marker hover/tap.
- DRIFT wordmark links home; the separate Signal glyph links to `https://go.loudestriot.com`.
- Explicit location opt-in, one location watcher, and a 250 m accuracy gate. Approximate/invalid fixes clear the location marker and never recenter the map.
- Dynamic viewport and safe-area layout for iPhone Safari portrait/landscape.
- Service worker v15: all app code network-first, API requests uncached, and no HTML fallback for missing scripts/styles.

## v0.9 — FIELD TEST
Status: shared-service foundation.

### Experience
- Map-first Hines Park interface with simplified onboarding.
- Minimal contemporary field UI with DRIFT wordmark and Signal Glyph.
- Location-aware signal states and proximity unlocks.
- Written-clue, field-map, and celestial navigation modes.
- Breadcrumb walks and personal intercepts remain local to the device.
- INFO directory with Loudest Riot, relay archive, Bandcamp, social, contact, and privacy links.

### Shared services
- Cloudflare Worker API.
- D1 database binding: `DB` → `driftdb`.
- Public shared intercepts are opt-in.
- Live coordinates are used in memory to verify proximity and are not written to the intercept record.
- Public Field Log at `/field-log.html` reads verified shared intercepts from D1.
- R2 photo support is implemented in the Worker under binding `PHOTOS`; the bucket must be created and bound before uploads are available.
- Public photos are served through the Worker only for public intercepts. The R2 bucket itself should remain private.

### Field-test priorities
1. Location permission and accuracy on real phones.
2. Can a new visitor understand what to do without explanation?
3. Signal discovery and proximity verification.
4. Shared intercept submission and public Field Log.
5. Optional photo upload after R2 is bound.
6. Landscape/mobile usability.

## Planned v0.10 — TERRAIN / SCAN
- WebGL mapping architecture.
- 3D terrain mode.
- LiDAR-derived SCAN mode.
- MAP remains the default low-friction experience.

## Version discipline
Meaningful field releases get a version heading here. Git commits remain the technical source history; this document records user-visible behavior and field-test milestones.
