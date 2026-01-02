# Phase 1 Help System Plan (Global Content)

## Goals (Phase 1)

- Provide a browseable Help Center with strong search across global content.
- Keep one canonical doc set, but render it “organization-aware” using:
  - Custom label tokens (Staff/Patients/Rooms/etc).
  - Feature + settings conditional sections (portal/self-booking/voice/etc).
- Produce an initial article backlog with clear ownership so we can assign + write content.

## Non-goals (Phase 1)

- Per-organization authored content.
- AI chat/voice interface (planned for later phases).
- Full in-app CMS (drafting/versioning/workflow).

---

## Source-of-truth content format

Author articles as Markdown with a small YAML front matter block for metadata + search.

Recommended repo layout (write content in-repo first, then import to DB later):

```text
docs/help/content/
  getting-started/
  people/
  rooms/
  schedules/
  rules/
  voice/
  settings/
  portal/
  troubleshooting/
  security/
```

---

## Article metadata schema (YAML front matter)

Use these keys consistently so we can later index + render conditionally.

```yaml
---
id: help.settings.custom-labels
slug: /help/settings/custom-labels
title: Custom Labels
category: settings
summary: Rename Staff/Patients/Rooms to match your practice.
audienceRoles: [super_admin, admin, admin_assistant]
tags: [labels, terminology, settings]

# Optional: used for search relevance and conditional display.
prerequisites:
  features: []        # keys like "patientPortalEnabled"
  settings: []        # keys like "timezone"
  org: []             # org-level config keys like "transcriptionProvider"

# Optional: query expansion (especially useful for label synonyms).
aliases:
  - terminology
  - rename patients
  - rename clients
---
```

Conventions:
- `id`: stable dotted key, never changes once published.
- `slug`: stable URL path; keep kebab-case.
- `category`: one of the folder names under `docs/help/content/`.
- `audienceRoles`: align with `UserRole` (`super_admin`, `admin`, `admin_assistant`, `staff`).

---

## Custom label tokens (must-use in prose)

These map to per-org label overrides (see org label fields in `Organization` in Prisma schema).

Use tokens in Markdown:

- `{{labels.staff.plural}}` / `{{labels.staff.singular}}`
- `{{labels.patient.plural}}` / `{{labels.patient.singular}}`
- `{{labels.room.plural}}` / `{{labels.room.singular}}`
- `{{labels.certification.plural}}`
- `{{labels.equipment.plural}}`

Token resolution precedence:
1. Organization custom label fields (per-org overrides).
2. Organization business type template defaults (if selected).
3. App defaults (e.g., “Staff”, “Patients”, “Rooms”).

Search note:
- At index-time (or query-time), expand common synonyms from templates (Therapists/Clinicians/Staff, Clients/Patients, etc.) so search works regardless of label choices.

---

## Conditional sections (features + settings driven)

Phase 1 recommendation: keep one canonical article and include variant sections gated by a key.

Suggested directive syntax inside Markdown (easy to parse later):

```md
<!-- help:when features.patientPortalEnabled -->
... portal-specific content ...
<!-- help:end -->
```

Optional else:

```md
<!-- help:when-not features.patientPortalEnabled -->
This feature isn’t enabled for your organization. An admin can enable it in Settings → Patient Portal.
<!-- help:end -->
```

Key spaces:
- `features.*` keys map to `OrganizationFeatures` (feature toggles).
- `settings.*` keys map to `OrganizationSettings` (business configuration).
- `org.*` keys map to organization-level config (e.g., transcription provider).

---

## Canonical key taxonomy (based on current UI + schema)

### `features.*` (from `OrganizationFeatures`)

Core toggles to reference in help content:
- `features.patientPortalEnabled`
- `features.portalAllowCancel`
- `features.portalAllowReschedule`
- `features.portalRequireConfirmation`
- `features.selfBookingEnabled`
- `features.selfBookingLeadTimeHours`
- `features.selfBookingMaxFutureDays`
- `features.selfBookingRequiresApproval`
- `features.emailRemindersEnabled`
- `features.smsRemindersEnabled`
- `features.advancedReportsEnabled`
- `features.reportExportEnabled`
- `features.voiceCommandsEnabled`
- `features.medicalTranscribeEnabled`
- `features.apiAccessEnabled` (future)
- `features.webhooksEnabled` (future)

Portal customization fields (still `features.*` in current schema):
- `features.portalWelcomeTitle`
- `features.portalWelcomeMessage`
- `features.portalPrimaryColor`
- `features.portalSecondaryColor`
- `features.portalLogoUrl`
- `features.portalBackgroundUrl`
- `features.portalShowOrgName`
- `features.portalContactEmail`
- `features.portalContactPhone`
- `features.portalFooterText`
- `features.portalTermsUrl`
- `features.portalPrivacyUrl`

### `settings.*` (from `OrganizationSettings`)

Primary settings to reference in help content:
- `settings.timezone`
- `settings.defaultSessionDuration`
- `settings.slotInterval`
- `settings.businessHours`
- `settings.lateCancelWindowHours`

### `org.*` (from `Organization`)

Org-level configuration keys to reference:
- `org.transcriptionProvider`
- `org.medicalSpecialty`
- `org.requiresHipaa`

---

## Writing standards (so articles are consistent)

For each article:
- Start with a 1–2 sentence summary + “When to use this”.
- Prefer task steps with numbered lists.
- Include a “How this changes with settings” section that uses conditional blocks.
- End with “Related articles” (by slug) + “Troubleshooting” bullets.
- Use label tokens everywhere you’d otherwise hardcode “Therapist/Patient/Room/etc”.

---

## Phase 1 Article Backlog (assignments)

Status values:
- `unassigned`, `drafting`, `in_review`, `ready`

> Tip: keep content global; don’t mention specific org names or template names unless it’s truly necessary.

| Category | Article Title | Suggested Slug | Audience | Prereqs (keys) | Source UI | Owner | Status |
|---|---|---|---|---|---|---|---|
| getting-started | What is Say It Schedule? | `/help/getting-started/overview` | admin, assistant, staff |  | App | Claude | ready |
| getting-started | Roles & permissions | `/help/getting-started/roles` | admin, assistant, staff |  | App | Claude | ready |
| getting-started | Glossary (labels + terms) | `/help/getting-started/glossary` | admin, assistant, staff |  | App | Claude | ready |
| people | Add and manage {{labels.staff.plural}} | `/help/people/staff` | admin, assistant |  | `/app/staff` | Claude | ready |
| people | {{labels.staff.singular}} profile fields | `/help/people/staff-profile` | admin, assistant |  | `/app/staff/:id` | Claude | ready |
| people | Add and manage {{labels.patient.plural}} | `/help/people/patients` | admin, assistant |  | `/app/patients` | Claude | ready |
| people | {{labels.patient.singular}} scheduling preferences | `/help/people/patient-preferences` | admin, assistant |  | `/app/patients/:id` | Claude | ready |
| rooms | Add and manage {{labels.room.plural}} | `/help/rooms/rooms` | admin, assistant |  | `/app/rooms` | Claude | ready |
| rooms | Room capabilities and matching | `/help/rooms/capabilities` | admin, assistant |  | `/app/rooms/:id` | Claude | ready |
| rules | How scheduling rules work | `/help/rules/overview` | admin, assistant |  | `/app/rules` | Claude | ready |
| rules | Rule categories and priorities | `/help/rules/categories` | admin, assistant |  | `/app/rules` | Claude | ready |
| rules | Create rules (UI) | `/help/rules/create` | admin, assistant |  | `/app/rules` | Claude | ready |
| schedules | Generate a schedule | `/help/schedules/generate` | admin, assistant |  | `/app/schedule/generate` | Codex | ready |
| schedules | View schedules | `/help/schedules/view` | admin, assistant, staff |  | `/app/schedule` | Codex | ready |
| schedules | Print/export schedules | `/help/schedules/print` | admin, assistant, staff |  | `/app/schedule/:id/print` | Codex | ready |
| voice | Voice commands overview | `/help/voice/overview` | admin, assistant | `features.voiceCommandsEnabled` | Voice flows | Claude | ready |
| voice | Voice transcription settings | `/help/voice/transcription-settings` | admin, assistant |  | `/app/settings` | Claude | ready |
| settings | Organization branding | `/help/settings/branding` | admin, assistant |  | `/app/settings` | Claude | ready |
| settings | Custom labels | `/help/settings/custom-labels` | admin, assistant |  | `/app/settings` | Claude | ready |
| settings | Suggested {{labels.certification.plural}} | `/help/settings/suggested-certifications` | admin, assistant |  | `/app/settings` | Claude | ready |
| settings | Suggested {{labels.equipment.plural}} | `/help/settings/suggested-equipment` | admin, assistant |  | `/app/settings` | Claude | ready |
| settings | Patient portal overview | `/help/settings/patient-portal` | admin, assistant | `features.patientPortalEnabled` | `/app/settings` | Claude | ready |
| settings | Self-booking controls | `/help/settings/self-booking` | admin, assistant | `features.selfBookingEnabled` | `/app/settings` | Claude | ready |
| settings | Portal customization fields | `/help/settings/portal-customization` | admin, assistant | `features.patientPortalEnabled` | `/app/settings` | Claude | ready |
| portal | Portal sign-in and verification | `/help/portal/sign-in` | staff (support), admin (support) | `features.patientPortalEnabled` | `/portal/*` | Claude | ready |
| portal | View appointments in portal | `/help/portal/appointments` | staff (support), admin (support) | `features.patientPortalEnabled` | `/portal/appointments` | Claude | ready |
| portal | Book an appointment (self-booking) | `/help/portal/booking` | staff (support), admin (support) | `features.patientPortalEnabled`, `features.selfBookingEnabled` | `/portal/booking` | Claude | ready |
| troubleshooting | Search, "no results", and best practices | `/help/troubleshooting/search` | admin, assistant, staff |  | Help Center | Claude | ready |
| troubleshooting | Voice troubleshooting | `/help/troubleshooting/voice` | admin, assistant | `features.voiceCommandsEnabled` | Voice flows | Claude | ready |
| security | MFA setup and account security | `/help/security/mfa` | admin, assistant, staff |  | `/mfa-setup`, `/app/account` | Claude | ready |
| security | HIPAA/BAA basics in the app | `/help/security/hipaa-baa` | admin, assistant | `org.requiresHipaa` | `/app/baa` | Claude | ready |

---

## Next steps (to start writing)

1. Assign owners to the backlog table above (Owner + Status).
2. Start with foundational articles that affect terminology + UX:
   - `Custom labels`
   - `Glossary`
   - `Settings overview` (optional add)
3. As we write, keep a running list of any additional tokens/keys we need so we can standardize them early.

