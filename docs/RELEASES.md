# DRIFT Release / Field Log

DRIFT is a location-based psychogeography and psychogeocaching PWA by Loudest Riot Sounds.

## v0.9 — FIELD TEST
Status: current field-test line.

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
