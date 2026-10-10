## Release 25 — Newburgh access address clarification (October 9, 2026)

- Matched a visitor-provided Hines Drive address range (37507–39399 Edward N Hines Dr, Livonia, MI 48150) to public listings for Newburgh Lake Public Access.
- Preserve “Newburgh Lake Pointe Public Access” as an alternative searchable name and show the address in HINES PLACES.
- Keep its exact entrance pin pending verification because the number range overlaps several lake access areas. Do not substitute Newburgh Pointe, the boat launch, or Sumac Pointe coordinates.

## Release 25 — Hines Places Catalog (October 9, 2026)

- Catalog 36 reference places across Hines Park. Source is Wayne County parks inventory, individual park pages, Michigan Water Trails, and existing DRIFT monuments.
- 24 locations have mapped place reference coordinates; remaining 12 are searchable with "PIN TO VERIFY" status rather than invented map markers.
- Newburgh Lake Pointe Public Access has a separate featured record with pending field-verified entrance pin, distinct from Newburgh Pointe and Newburgh Lake Public Boat Launch.
- Load `public/data/hines-places.json` in LANDMARKS map overlay and PLACES selector. Coordinates are general places, never turn-by-turn parking directions.
- Searchable places directory and map selection. Missing pins can be contributed as visitor waypoints and subsequently reviewed for the official index.
- Clarify public waypoint workflow, review and separation from private journal notes. No auto-approval.
- Bump frontend and service worker cache to release 25.

## Release 24 — Public Photo Log (October 9, 2026)

- Add `/photo-log.html`: a responsive photo-first field gallery with source filters, captions, dates, and an accessible full-screen viewer.
- Source A: only opt-in photos from verified public intercepts in D1/R2, filtered server-side by `public=1`, `verified=1`, and a non-null `photo_key`. Image routes still require public status; no private journal data are read.
- Source B: curated editor-selected images from `public/data/photo-log.json`. The manifest begins empty; only records marked `public: true` are shown. This avoids accidentally publishing unapproved imagery.
- Add offset pagination and `photos_only=1` filtering to `/api/intercepts` so later photos are not hidden by text-only public finds. Public intercept listing remains backward-compatible.
- Protect photo uploads using a single-use capability returned when the intercept is created. Existing D1 schemas add `photo_upload_token` on first initialization; legacy submissions without capabilities cannot be overwritten.
- Browser prepares photos as bounded-size JPEGs, stripping embedded EXIF metadata before upload; uploads accept validated JPEG, PNG, and WebP only. No image from private journal is automatically published.
- Link the Photo Log from ABOUT, Features, and Public Field Log. Add release 24 to Field Notes and bump all frontend and service worker caches together.
- Editor-maintained photos and submission guidance: `docs/PHOTO_LOG.md`. This release does not add anonymous public uploads or automated moderation.
## Release 23 — Public Field Notes (October 9, 2026)

- Add `public/updates.html`, an accessible and mobile-readable public history that translates existing release notes into visitor-facing language.
- Link FIELD NOTES // UPDATES from ABOUT > EXPLORE and the Features page footer. Keep map and bottom navigation uncluttered.
- Retain this file as the technical source of truth, including implementation details that do not belong on the public page. Future meaningful releases should update both this history and the public summary.
- Advance asset and service worker versions together to release 23; add `updates.html` to the offline app shell.

## Release 22 — Waypoints + field journal (October 8, 2026)

- Curated landmarks remain named places; user waypoints have a separate map layer. Types include cool spot, geological feature, rock, bird sighting, plant, and place. Existing device records and submissions are retained using their current storage identity and table.
- JOURNAL puts waypoints first. Each waypoint supports multiple private, dated observation notes and note removal. Journal entries are included in device exports, with waypoint coordinates still opt-in, and are never sent in a waypoint submission.
- Map options nests layers, map styles, reset, status and start-help. Route nests record/save/clear controls and shows RECORDING when closed during a walk. Both disclosures default closed. Profile/export and coordinate entry are also collapsed to fit a phone screen.
- `/api/waypoints` accepts the new types and exposes only approved submissions. The previous `/api/landmarks` route remains compatible with saved clients. Review still uses the existing authenticated D1 console and `landmarks` table; the release 21 review instructions apply.
- Bird sightings mark an observation spot, not a permanent location. No new image uploads, accounts, or background location access.

## Release 21 — Personal landmarks (October 8, 2026)

- Add a named landmark with optional notes and a type. Choose a draggable map pin, enter coordinates, or explicitly request a precise device location.
- Landmarks persist on the device, appear in PLACES and SAVED, and can be edited or removed. Exports omit their coordinates unless the coordinate checkbox is selected.
- SUBMIT FOR REVIEW explicitly sends the saved version to `/api/landmarks`. Retries use the same UUID. Only approved submissions are returned by the public API; no anonymous approval endpoint exists.
- Failed saves preserve the form; failed submissions preserve the local landmark. Editing/removing a local copy does not change the submitted version.
- Runtime schema initialization creates the landmarks table without a manual migration step. `migrations/0002_landmarks.sql` provides the same schema for managed migration workflows.

### Review submitted landmarks

Review through the existing Cloudflare D1 database bound as `DB` to the production `drift` Worker. No new account or public admin interface is required. In the authenticated D1 console, list pending records:

```sql
SELECT id, name, kind, note, lat, lng, created_at
FROM landmarks WHERE status = 'pending' ORDER BY created_at;
```

Check the pin, description, public access, duplicate landmarks, and sensitivity. A cemetery or memorial remains a reference landmark, never a cache. Approve only the exact reviewed ID using a bound parameter or a safely quoted UUID:

```sql
UPDATE landmarks SET status = 'approved' WHERE id = '<reviewed UUID>' AND status = 'pending';
```

Reject with `status = 'rejected'` instead. Reloading DRIFT fetches approved community landmarks. The device copy retains its submitted status; that label is not a live review tracker. Use the authenticated database console for requested submission edits/removal; device edits do not rewrite shared records.

# DRIFT Release / Field Log

DRIFT is a location-based psychogeography and psychogeocaching PWA by Loudest Riot Sounds.

## v0.19 — DEVICE PROFILE + LOCATION FEEDBACK
- NFC cards are optional reference links; the guide describes possible destinations without promising a card at every marker or automatic verification.
- LOCATE returns to the map, requests a fresh fix on repeat taps, and provides persistent permission, timeout, and accuracy feedback.
- SAVED includes an optional device-local nickname and JSON export; precise route coordinates require an explicit checkbox. No login, sync, or import is implied.
- Privacy notice covers local profiles and exported data. Asset/cache versions advance together to v19.

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

