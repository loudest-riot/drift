# DRIFT email activation

## Confirmed setup

- Resend domain: `drift.loudestriot.com`, verified October 11, 2026.
- Sender: `DRIFT <fieldnotes@drift.loudestriot.com>`.
- Reply-to and waypoint-review recipient: `sounds@loudestriot.com`.
- Mailing-list segment: **DRIFT Field Notes**, ID `6fc3f7a1-a766-499b-a96d-4ec93b9818d8`.
- Connected account: free limits of 1,000 contacts, 100 transactional emails/day, 3,000/month. Broadcast sends are separate from transactional sends.

No contacts were imported and no test email or broadcast was sent during implementation. Signup is hidden and email sending is disabled until the Worker is configured.

## Activate on the existing Worker

In Cloudflare, open Workers & Pages → **drift** → Settings → Variables and Secrets.

1. Add `RESEND_API_KEY` as a **Secret**, using a Resend key with contact management and sending access. Resend full-access keys support both. Create it in the Resend dashboard, store it directly in Cloudflare, and never commit it or paste it into public files.
2. Set `RESEND_ENABLED` to text value `true`.
3. Set `RESEND_WAYPOINT_ALERTS` to text value `true` if automatic review emails are wanted.
4. Apply/deploy the settings. Check `/api/newsletter/status`; `newsletter` should be `true`, with `waypoint_notifications` true only when its flag is on.

This checkout has no authenticated access to the user's Cloudflare environment, so these activation settings were not applied. A ChatGPT Resend connection does not automatically supply an application API key to Cloudflare.

If the custom domain is bound to a different Worker, configure that exact Worker instead. GitHub currently builds both `drift` and `loudest-riot-drift-git`; verify the custom-domain binding rather than adding a secret to an unrelated deployment.

## Verify after activation

- Open ABOUT → FIELD NOTES BY EMAIL and sign up using an address you control. Consent starts unchecked.
- A confirmation email arrives from the verified DRIFT sender. Open its link, then press CONFIRM MY SUBSCRIPTION. Merely opening the link never adds a contact.
- Verify that the address appears in the DRIFT Field Notes segment. Existing global unsubscribe status is preserved.
- Submit a test waypoint if desired. The D1 row remains pending; its review alert goes to the recipient above. Private journal notes and photos are excluded.
- Inspect the D1 `email_outbox` for failed or delayed jobs. Email delivery does not replace review or approve submissions.

## Reliability and operating limits

The ten-minute Worker cron processes durable email jobs. Stable provider idempotency keys cover duplicate submissions and interrupted sends. Transient failures retry with exponential delays; permanent failures stop. Retry jobs stop after 22 hours, within the provider's idempotency window, rather than risk duplicate delivery. Application delivery attempts are capped at 90/day; other sends on the same Resend account still consume its provider allowance. Signups also have hourly address/IP limits, a one-minute resend cooldown, and a honeypot.

Sent jobs retain status and provider ID but discard the message body. Failed message bodies are cleared after one day. Unconfirmed signup records expire after 48 hours and are cleaned up after a one-day grace period. Confirmed addresses/consent remain private in D1; Resend handles global newsletter suppression. No subscriber list is exposed through the public API.

Before sending newsletters, use this dedicated segment, include Resend's unsubscribe placeholder, and add the sender's valid mailing address. No broadcasts are automatically sent by this app release.

## Disable

Set `RESEND_ENABLED=false` to hide signup and stop sending. Existing waypoint submission and journal functions continue working. Set only `RESEND_WAYPOINT_ALERTS=false` to keep signup active while disabling newly queued waypoint alerts. Inspect any already-queued alerts before switching flags; previously queued messages can still be delivered while overall email sending remains enabled.
