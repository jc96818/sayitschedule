# Market Expansion Findings: ABA + PT + Client Self‑Booking

## Purpose
Document findings from a quick implementation review of the current Say It Schedule codebase, with recommendations for a V1 that supports ABA and PT while expanding toward broader small-business scheduling with client self-booking.

## Executive Summary
- The codebase is already more than “therapy scheduling”: it has strong multi-tenant foundations, per-organization labeling/templates, business-hours/slot settings, session lifecycle tracking, and feature flags for portal/reminders.
- The biggest gap for “patient participation” / client self-booking is not the UI copy or data isolation; it’s the absence of a true portal identity/auth model and public-facing booking flows.
- A commercially viable V1 for ABA + PT can remain “not a full PMS” if it delivers a reliable booking engine, a portal for confirm/cancel, and reminders—while leaving billing/clinical notes in existing systems.

## What’s Already Implemented (Relevant to V1)

### Platform Foundations
- Multi-tenancy and org isolation: core entities are scoped by `organizationId`.
- RBAC roles are implemented (`super_admin`, `admin`, `admin_assistant`, `staff`).
- Audit logging exists for many state-changing operations.
- Business type templates + per-org label overrides exist to make the UI terminology adaptable (e.g., Patients → Clients).

### Scheduling and Operations
- Organization business configuration exists:
  - Business hours per day
  - `slotInterval`
  - `defaultSessionDuration`
  - `lateCancelWindowHours`
  (see `backend/src/routes/settings.ts`, `backend/prisma/schema.prisma`)

- Session lifecycle is modeled and implemented:
  - Status transitions (`scheduled`, `confirmed`, `checked_in`, `in_progress`, `completed`, `cancelled`, `late_cancel`, `no_show`)
  - Cancellation reasons (includes `patient_request` and `caregiver_request`)
  - Confirmation tracking (`confirmedAt`, `confirmedById`)
  (see `backend/src/routes/sessions.ts`, `backend/prisma/schema.prisma`, `backend/src/repositories/schedules.ts`)

### Feature Flags / Tiers (Useful for Packaging)
- Organization feature flags exist for:
  - Patient portal
  - Email/SMS reminders
  - Voice commands
  - API access / webhooks
  (see `backend/src/repositories/organizationFeatures.ts`, `backend/src/middleware/featureGuard.ts`)

## Where “Patient Participation” Is Partially Implemented (But Not Complete)

### Portal: Configuration Exists, Portal Product Does Not
- There is a portal configuration endpoint (`GET /settings/features/portal`) and feature flags (`patientPortalEnabled`, etc.).
- There is no portal route group in the frontend router, and no portal UI pages.
- “Confirm session” exists as `POST /api/sessions/:id/confirm`, but it is protected by staff JWT auth (normal `authenticate`), so it is not usable by a real patient/caregiver without additional portal auth.

### Patient/Client Contact Data Is Not in the Backend Model
- The frontend `Patient` type includes fields like `guardianName/Phone/Email`, `sessionDuration`, and `genderPreference`.
- The backend `Patient` model does not currently store guardian/contact fields or session duration. These are currently “UI-only” and not persisted.

### AI Scheduler Is Still Therapy-First
- The AI schedule generation prompts and data types assume a therapy weekly schedule (“therapists/patients”, “sessions per week”).
- This is fine for admin-driven ABA schedule generation, but PT and broader small-business self-booking will need AI to shift toward “slot finding and ranking” rather than “generate the week”.

## Recommended V1: “Therapy-Grade Scheduling + Portal + Reminders (Not PMS)”

### Product Positioning
- **Scheduling and communications layer** that can coexist with existing practice systems.
- For low-margin ABA: reduce admin time, reduce no-shows, and improve schedule stability.
- For PT: support variable appointment lengths, patient confirmations, and easier rescheduling workflows.

### V1 Must-Have Capabilities

#### 1) Booking Engine (Deterministic Source of Truth)
Implement a canonical availability + booking flow that does not depend on AI or voice:
- Compute availability from:
  - Staff default hours
  - Staff time-off overrides (approval workflow already exists)
  - Organization business hours
  - Existing sessions + room/resource conflicts
- Provide slot search endpoints that return valid time slots given:
  - date range
  - desired duration
  - staff (optional)
  - room/resource constraints (optional)
- Prevent double-booking with a short-lived “hold” during checkout.

#### 2) Portal Authentication (Separate From Staff Auth)
Add a portal identity model so patients/caregivers can act without a staff JWT:
- Magic link or one-time code to email/SMS.
- Portal sessions scoped to an organization and a contact.
- Strict data access: portal users can see only the patient(s) they’re linked to.

#### 3) Portal Actions (V1)
- View upcoming appointments.
- Confirm appointment (sets status to `confirmed`).
- Cancel appointment (applies cancellation policy → `cancelled` vs `late_cancel`).
- Reschedule: V1 can be “cancel + rebook” or “request reschedule”; true reschedule can be a follow-up milestone.

#### 4) Reminders + Confirmation Links (Email First)
- Email reminders with per-org timing (`reminderHours`).
- Include confirm/cancel links that work for portal users (or one-time action tokens).
- Track reminder outcomes (sent, delivered, confirmed, cancelled).

#### 5) AI Assist (Prominent, Optional)
Keep AI prominent while maintaining deterministic correctness:
- Slot ranking (“best options”) based on constraints/preferences.
- Natural-language parsing for typed input (use the same parser as voice; voice is optional).
- Exception handling: propose alternatives when no valid slots exist.
- De-emphasize “generate the whole week” for PT; keep it as an admin tool for ABA-heavy clinics.

### Explicitly Out of Scope for V1 (To Avoid Becoming a PMS)
- Billing/claims/CPT codes.
- Clinical documentation / SOAP notes.
- Insurance eligibility / clearinghouse integrations.
- Full intake/referral pipeline.

## Minimal Data Model Additions (Suggested)

### Contacts and Portal Identity
- `PatientContact` (or `ClientContact`):
  - `patientId`, `name`, `email`, `phone`
  - relationship (`self`, `caregiver`, etc.)
  - reminder/marketing opt-in flags
  - `canAccessPortal`
- `PortalLoginToken` (one-time token):
  - `contactId`, `expiresAt`, `usedAt`
- `PortalSession`:
  - `contactId`, `expiresAt`, hashed session token

### Booking Safety
- `AppointmentHold`:
  - organizationId
  - staffId/roomId (optional)
  - start/end
  - expiresAt
  - createdBy (portal contact vs staff)

### Appointment Metadata
- Keep using `Session` as the appointment record, but consider adding:
  - `bookedByContactId` (nullable)
  - `bookedVia` enum (`admin`, `staff`, `portal`)
  - optional `serviceId` (V1.5+)

## API Surface (Suggested)

### Portal Auth
- `POST /api/portal/auth/request` (email/SMS magic link)
- `POST /api/portal/auth/verify` (exchanges token for portal session)
- `POST /api/portal/auth/logout`
- `GET /api/portal/me`

### Portal Appointments
- `GET /api/portal/appointments`
- `POST /api/portal/appointments/:sessionId/confirm`
- `POST /api/portal/appointments/:sessionId/cancel`
- (Optional V1.5) `POST /api/portal/appointments/:sessionId/reschedule`

### Availability + Booking
- `GET /api/booking/availability` (returns time slots)
- `POST /api/booking/hold` (creates hold)
- `POST /api/booking/book` (creates session from hold)

## Frontend Additions (Suggested)
- Add a portal route group (either separate Vue app or `/portal/*` routes) distinct from `/app/*`.
- Portal pages:
  - Login (enter email/phone)
  - Verify (one-time code) or magic link handler
  - My Appointments (list + detail)

## Humanity (TCP) Integration Strategy (Pragmatic)
- V1: do not attempt deep integration.
  - Provide exports (CSV) and calendar feeds (ICS) so staff can mirror appointments.
- V1.5: add optional “blocked times import” (manual upload) or basic integration if demand is strong.

## Key Risks / Decisions
- **Identity and security:** portal auth must be separated from staff auth; careful scoping is required.
- **Race conditions:** booking must be protected with holds and idempotency.
- **Timezone correctness:** org timezone must be consistently applied for reminders and slot generation.
- **Terminology drift:** continue using label templates to avoid hardcoding “patient/therapist” language.
- **AI trust boundary:** AI should propose/rank; deterministic logic must enforce constraints.

## Recommended Next Steps
1. Align on V1 target: ABA + PT scheduling + portal confirm/cancel + email reminders.
2. Decide the portal auth mechanism (magic link vs OTP) and contact model.
3. Implement availability + hold + book APIs first (everything else depends on this).
4. Add portal route group + minimal UI.
5. Rework AI usage toward slot ranking and natural-language booking requests (typed-first; voice optional).

