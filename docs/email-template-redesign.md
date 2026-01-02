# Email template redesign (deliverability + readability + branding)

## Scope (current code)

Email templates live in `backend/src/services/email.ts`:

- User invitation (`sendUserInvitation`)
- Super admin invitation (`sendSuperAdminInvitation`)
- Password reset (`sendPasswordResetEmail`)
- Schedule published (`sendSchedulePublishedNotification`)
- Time-off request submitted (`sendTimeOffRequestSubmitted`)
- Time-off request reviewed (`sendTimeOffReviewed`)
- Lead notification (`sendLeadNotification`)

## Goals

- **Deliverability:** Keep markup simple and email-client-friendly; reduce spam triggers; ensure reliable rendering in Outlook/Gmail/mobile.
- **Readability:** Clear hierarchy, short copy, accessible typography, prominent CTA with a plain-link fallback.
- **Branding:** Light organization branding (name + accent color) without heavy imagery or complex styling.

## Recommended template structure

1. **Preheader text** (hidden preview line) that restates the CTA and expiry.
2. **Single-column 600px layout** using `<table role="presentation">` for consistent rendering.
3. **White “card”** with a thin **accent bar** in the organization’s primary color (branding without a full-bleed colored header).
4. **Clear heading** + short paragraphs (avoid long blocks).
5. **One primary CTA** (table-based “bulletproof” button).
6. **Fallback link** (copy/paste friendly) directly under the CTA.
7. **Concise footer** clarifying who sent it and what to do for support.

## Content & wording recommendations

- Keep the first line action-oriented (invite/reset) and avoid marketing language.
- Always include:
  - what happened (invite/reset request)
  - what to do next (CTA)
  - who initiated it (invited by / “someone requested”)
  - expiry window
  - “ignore if not you” safety line
- Avoid including unnecessary personal details (name/email can be enough; avoid role dumps unless it’s important like super admin).

## Deliverability recommendations (non-template)

- Ensure SES identity has **SPF + DKIM** aligned with `EMAIL_FROM` domain.
- Consider setting `EMAIL_FROM` to a dedicated subdomain like `noreply@mail.something.com` with aligned DKIM.
- Keep images optional; if adding a logo later, host it over HTTPS and provide alt text.
- Keep HTML and text parts aligned (same core content and links).
- Avoid large inline CSS blocks; prefer minimal inline styles.

## Branding recommendations

- Use organization **name** and **primary accent color**.
- If/when adding logos: keep them small, avoid embedded/base64 images, and do not rely on background images.
