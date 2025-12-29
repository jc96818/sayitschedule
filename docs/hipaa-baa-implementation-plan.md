# HIPAA BAA (Business Associate Agreement) Feature — Findings & Implementation Plan

Date: 2025-12-29

## Goal
Require each customer organization to execute a HIPAA Business Associate Agreement (BAA) before the app is used for PHI/regulated workflows.

Requirements:
- An organization admin can view and electronically sign the BAA.
- Superadmin can view BAA status for every organization and download executed BAAs.
- The BAA uses the HHS BAA template, customized for Say It Schedule.

## Key Findings (Current App)

### Multi-tenant + roles exist
- Multi-tenant context is enforced server-side via JWT + tenant validation (`backend/src/middleware/auth.ts`, `backend/src/middleware/tenantValidation.ts`).
- Roles exist: `super_admin`, `admin`, `admin_assistant`, `staff` (`backend/prisma/schema.prisma`).
- Frontend has role-aware routing and a dedicated superadmin area (`frontend/src/router/index.ts`, `frontend/src/layouts/SuperAdminLayout.vue`).

### Superadmin org management exists
- Superadmin can list orgs and “enter” an org context (`frontend/src/pages/SuperAdminDashboardPage.vue`).

### HIPAA risk note (important)
- Schedule generation sends staff/patient details to OpenAI (`backend/src/services/openai.ts`).
  - If this includes PHI and is processed by a vendor without an appropriate BAA/coverage, it can be a HIPAA blocker.
  - Even with a signed customer BAA, subcontractor/vendor coverage must be aligned.

## Recommended Implementation Approach

### Option A (Recommended): Use an e-sign provider
Use DocuSign / Dropbox Sign / Adobe Sign to present the HHS BAA template PDF for signature.

Why this is recommended:
- Strong legal defensibility (tamper-proof executed PDF, robust audit trail).
- Less custom “ESIGN Act / UETA” compliance work.
- Built-in signer identity controls and retention.

What the app stores:
- Provider envelope id
- Status (`sent`, `viewed`, `signed`, `completed`, `voided`)
- Who signed (admin user id + name/title/email as captured)
- Timestamps
- Final executed PDF (or provider download URL + stored hash)

### Option B: In-app e-signature (MVP; counsel review required)
Build an internal signing page that captures consent + signature and generates an executed PDF.

Minimum defensibility requirements:
- Explicit consent to electronic signing (checkbox + timestamp).
- Signer identity and role validation (must be org `admin`; optionally require MFA-enabled).
- Audit trail: signer user id, name/title/email, IP address, user-agent, signed timestamp.
- Tamper resistance: generate a final PDF and store a SHA-256 hash of the PDF; treat as immutable.

## Proposed Product Behavior

### Status model
- `not_started`: no BAA record yet
- `awaiting_org_signature`: admin must sign
- `awaiting_vendor_signature`: awaiting countersignature (Say It Schedule)
- `executed`: fully signed; organization is “BAA-complete”
- `voided` / `superseded`: for future renewal/versioning

### Access rules
- Org admins can:
  - View the current BAA
  - Sign the BAA (org-side signature)
  - Download the executed PDF once complete
- Org non-admin users can:
  - View status and download executed PDF (optional), but cannot sign
- Superadmin can:
  - View status for all orgs
  - Download any org’s executed PDF
  - Countersign (vendor signature) if using in-app flow

### Enforcement (“gating”)
Block PHI-heavy features until `executed`.

Server-side gating is required (frontend-only gating is not sufficient).

Candidate routes to gate (at minimum):
- `/api/patients/*`
- `/api/schedules/*` (including export)
- `/api/voice/*`
- `/api/transcription/*`

Note: If you want non-PHI demo capability, consider allowing “sandbox/demo mode” with clear restrictions.

## Data Model (Prisma)
Add new tables (names indicative):

### `BaaAgreement`
- `id`
- `organizationId`
- `status`
- `templateName` (e.g., `hhs-baa-2020-xx`)
- `templateVersion` (string)
- `templateSha256` (hash of template bytes)
- `executedPdfSha256` (hash of executed pdf)
- `executedPdfPath` or `executedPdfBytes` (depending on storage choice)
- `orgSignedAt`, `orgSignerUserId`, `orgSignerName`, `orgSignerTitle`, `orgSignerEmail`, `orgSignerIp`, `orgSignerUserAgent`
- `vendorSignedAt`, `vendorSignerUserId` (superadmin), `vendorSignerName`, `vendorSignerTitle`, `vendorSignerEmail`
- `createdAt`, `updatedAt`

(If using an e-sign provider, include `provider`, `envelopeId`, `providerStatus`, `providerPayload`.)

## Backend API Plan (Fastify)

### Org-scoped routes
- `GET /api/baa/current`
  - Returns status + metadata for the current org.
- `GET /api/baa/current/pdf`
  - Returns either the unsigned template PDF (if not executed) or executed PDF (if executed).
- `POST /api/baa/current/sign`
  - Admin-only. Captures signer info + signature. Transitions to `awaiting_vendor_signature`.

### Superadmin routes
- `GET /api/super-admin/baa`
  - List orgs + BAA status, signed timestamps.
- `GET /api/super-admin/baa/:organizationId`
  - Detail view + download links.
- `POST /api/super-admin/baa/:organizationId/countersign`
  - Superadmin-only. Completes execution.

### Middleware additions
- `requireExecutedBaa()`
  - Checks org context, loads BAA status, blocks gated routes with `403` + reason.

## Frontend UI Plan (Vue)

### Organization admin experience
- Add a route `/baa` (under org app layout).
- Page sections:
  - Status banner
  - Read-only BAA viewer (PDF embed/download)
  - Sign flow (consent checkbox + signature capture)
  - “Executed” download button

Add a sidebar link for admins: “BAA / HIPAA Agreement”.

### Superadmin experience
- Add “BAA Status” to the org list table (`frontend/src/pages/SuperAdminDashboardPage.vue`).
- Optional: a dedicated `/super-admin/baa` page for filtering + exports.

### UX gating
- If BAA not executed, redirect org users to `/baa` and show a “blocked until signed” message.
  - Still enforce on backend.

## HHS Template Usage & Customization

### Template source
- The repo currently does not include an HHS BAA template file.
- Proposed: add the exact chosen HHS BAA template PDF/doc to `docs/legal/` and treat it as the canonical input.

### Customization checklist (needs team + counsel signoff)
- Parties:
  - Covered Entity: customer organization legal name/address
  - Business Associate: Say It Schedule legal entity name/address
- Description of services (tie to actual product): scheduling, voice transcription, schedule exports, support.
- Subcontractors:
  - AWS (hosting, transcription if used)
  - Any AI provider used for PHI (re-evaluate `backend/src/services/openai.ts` behavior)
- Permitted uses/disclosures
- Safeguards and security rule commitments
- Breach notification contact and timeframe
- Return/destroy of PHI termination terms
- Governing law / term / survival clauses (if allowed)

## Open Questions (Need Team Decisions)
1. Do we require vendor countersignature, or is org signature sufficient for go-live?
2. Which e-sign vendor (if Option A)?
3. Where will executed PDFs be stored (DB vs object storage)?
4. Exactly which routes/features are blocked prior to execution?
5. Will we require MFA for the signing admin?
6. What is the policy for renewing BAAs (template versioning + superseding prior agreements)?
7. What PHI is sent to external processors today (OpenAI/voice), and can it be minimized or removed?

## Phased Delivery Plan

### Phase 1 (Core)
- Data model + basic status tracking
- Org `/baa` page (view + sign)
- Superadmin BAA status view
- Backend gating for PHI-heavy routes

### Phase 2 (Compliance hardening)
- Immutable executed PDFs + hashing
- Better audit log hygiene (avoid duplicating PHI in audit logs)
- Renewal/versioning support

### Phase 3 (Provider integration)
- Integrate a third-party e-sign platform for executed PDF + audit trail.

