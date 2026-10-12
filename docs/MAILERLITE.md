# MailerLite connection

The optional signup link is implemented but hidden until configured. No fake form or email capture is shown.

1. Create a MailerLite form or landing page for a DRIFT group; enable double opt-in in MailerLite.
2. Copy its published public signup URL (not an editor URL or embed script).
3. Set `MAILERLITE_FORM_URL` as a text environment variable on the existing Cloudflare **drift** Worker, and deploy that environment change.
4. `/api/integrations` exposes only this public HTTPS URL. ABOUT shows FIELD NOTES BY EMAIL once configured.
5. Test signup and confirmation using an address you control.

No MailerLite API token is needed for a hosted form. Never put a MailerLite API token in public files, Git, or this environment variable. Sender identity and verification for sounds@loudestriot.com are configured in MailerLite.

Waypoint submissions still write pending records to D1. EMAIL REVIEW REQUEST opens a visitor-controlled email draft to sounds@loudestriot.com with submission ID and waypoint details, excluding private notes/photos. It does not send automatically. Automatic submission notifications require a transactional mail provider (such as MailerSend) and a server-side secret; no such connection is configured or claimed by this release.
