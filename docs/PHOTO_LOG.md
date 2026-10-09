# DRIFT // Public Photo Log

Public gallery: [photo-log.html](https://drift.loudestriot.com/photo-log.html)
Source page: public/photo-log.html

## Two editorially separate photo sources

**Verified, opted-in field photos** come from `/api/intercepts?photos_only=1` and Cloudflare R2. These are pictures attached to a verified find whose creator selected public sharing. The public API filters against private finds. The gallery never accesses device-local journal data.

**Curated field dispatches** come from `public/data/photo-log.json`. Its initial `photos` list is empty on purpose. To publish a selected photograph, first upload a rights-cleared image to `public/assets/field-photos/` (or use an unchanged HTTPS image URL you control), then add a JSON entry:

```json
{
  "public": true,
  "src": "assets/field-photos/example.jpg",
  "place": "Newburgh Access",
  "date": "2026-10-08",
  "caption": "Evening light on the water.",
  "alt": "Orange evening light reflected in the lake.",
  "credit": "nøfuture"
}
```

This example is documentation, not a published photograph. Setting `public` to anything but `true` omits the item from the gallery. Every curated photograph should have meaningful alt text, a place label, the image's date if known, and permission from its creator.

## Public contribution path

A visitor can upload a photo while sharing a **verified** field intercept. The explicit checkbox opts that find, its optional display name and note, and its photo into the Public Field Log and Photo Log.

Public images are linked to a signal name, not a stored verification coordinate. They may still reveal sensitive information visually. Ask contributors not to include people's faces, private property details, sensitive ecology sites, or license plates without permission.

Uploads are resized, flattened to JPEG, and stripped of EXIF metadata by the browser. The Worker requires the single-use upload capability returned at intercept creation. Private intercept photos stay non-public. No anonymous free-form photo posting or automatic moderation has been added.

For a standalone photo not tied to an intercept, the Photo Log offers an email submission to `sounds@loudestriot.com`, which requires manual editorial review. Do not add mailed photos to the public JSON manifest before reviewing permission and content.

## Limits and follow-up

- Public intercept photos are fetched 24 at a time using the photo-only, offset-based API.
- Curated manifest entries are currently hand-edited; a future editor dashboard can manage them.
- Images attached to already-submitted historical intercepts cannot be replaced without an authorized moderation workflow.
- Photos uploaded to R2 depend on the Worker `PHOTOS` binding and a functioning `drift-photos` bucket.
- For removal requests, use the instructions on the privacy page.
- Photos from private journal notes and device-local waypoints are never pulled into this gallery.
- Do not alter `src/index.js` to publish private records automatically.
