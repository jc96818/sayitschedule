# Multi-Tenant Security/Privacy Review (Backend)

Date: 2025-12-27

Scope reviewed:
- Backend tenant context/auth (`backend/src/middleware/*.ts`)
- Primary API routes (`backend/src/routes/*.ts`)
- Repositories / DB scoping (`backend/src/repositories/*.ts`, `backend/src/db/schema.ts`)
- Recent additions: rooms, schedule PDF export, schedule draft copy, updated OpenAI usage
- Infra config files opened in IDE: `infrastructure/terraform-demo/terraform.tfvars`, `infrastructure/terraform-shared/terraform.tfvars`

## Executive Summary

The main cross-tenant risk remains: the application derives `request.ctx.organizationId` from the request `Host`/subdomain and most routes scope authorization and queries using that value, without verifying it matches the authenticated user’s `organizationId` from the JWT. This makes “host-org confusion” a likely cross-tenant read/write vulnerability across many endpoints.

New features (rooms + schedule PDF export + schedule draft copy) follow the same org-context pattern, increasing the blast radius.

Additional privacy risks exist around logging and sending patient/staff details to OpenAI. Infrastructure tfvars contain plaintext secrets.

## Findings

### 1) Critical — Host-derived org context can bypass tenant isolation (cross-org read/write)

**What happens**
- `organizationMiddleware` sets `request.ctx.organizationId` from `request.headers.host` subdomain (`backend/src/middleware/organization.ts:43`).
- `authenticate()` only sets `request.ctx.organizationId` from JWT if the org is still unset (`backend/src/middleware/auth.ts:18`).
- Most org-scoped routes trust `request.ctx.organizationId` (not `request.ctx.user.organizationId`) to authorize and scope DB queries.

**Impact**
- A user from org A can send requests with a valid org A JWT while using org B’s host/subdomain, causing the server to scope queries to org B.
- This enables cross-tenant reads/writes for any route that trusts `request.ctx.organizationId`.

**Key code references**
- Org context from host: `backend/src/middleware/organization.ts:43`
- JWT org only fills missing ctx: `backend/src/middleware/auth.ts:18`
- Typical scoping pattern:
  - `backend/src/routes/staff.ts:24`
  - `backend/src/routes/patients.ts:26`
  - `backend/src/routes/schedules.ts:47`
  - `backend/src/routes/users.ts:24`
  - `backend/src/routes/rooms.ts:20`

**Notes**
- `GET /api/organizations/:id` correctly checks JWT org vs requested org (`backend/src/routes/organizations.ts:55`). This pattern should be generalized.

**Fix options (pick one and standardize)**
1. **JWT is source of truth for tenant** (recommended):
   - For non-super-admin users, set `request.ctx.organizationId = request.ctx.user.organizationId` (always), and ignore host-derived org for authorization.
   - Host/subdomain can be used for UX/branding only.
2. **Require host + JWT org match**:
   - If both are present and differ, return `403` (except super_admin).
   - This preserves “org by subdomain” routing while preventing confusion.

**Acceptance criteria**
- Requests with JWT(org A) + Host(org B) fail with `403` for non-super-admin users.
- All org-scoped endpoints use an org id that is guaranteed to match the authenticated tenant.

---

### 2) High — Sessions can reference cross-tenant staff/patient/room IDs (object linking)

**What happens**
- Session create/update accepts `staffId`/`patientId` (and now `roomId` at the DB level) without validating these entities belong to the schedule’s organization.
- Schedule session reads join by IDs only.

**Impact**
- If an attacker can obtain UUIDs from another org (made easier by Finding #1), they can create sessions in their org’s schedule referencing other org’s staff/patients/rooms.
- This can leak names/attributes via joined reads (e.g., schedule details and PDF export).

**Key code references**
- Create session lacks membership checks: `backend/src/routes/schedules.ts:258`
- Schedule reads join by IDs: `backend/src/repositories/schedules.ts:100`
- Sessions table has no `organization_id`: `backend/src/db/schema.ts:110`

**Fix options**
- App-layer validation on session create/update:
  - Ensure `staff.organization_id == schedule.organization_id`
  - Ensure `patients.organization_id == schedule.organization_id`
  - Ensure `rooms.organization_id == schedule.organization_id` (if roomId used)
- Stronger DB approach:
  - Add `organization_id` to `sessions` and enforce consistency with schedule and referenced entities.
  - Alternatively add triggers to enforce org consistency across references.

**Acceptance criteria**
- Session create/update rejects mismatched org references.
- Schedule views/PDF cannot leak cross-tenant names via joined entities.

---

### 3) Medium — Schedule delete/delete-sessions is not org-scoped at the session delete step

**What happens**
- Schedule deletion deletes sessions by `scheduleId` without also enforcing `organizationId` at the same time.

**Impact**
- Not typically exploitable alone if scheduleId cannot be reached cross-tenant, but combined with Finding #1 it can widen impact.

**Key code reference**
- `backend/src/repositories/schedules.ts:181`

**Fix**
- Delete sessions via a join on schedules constrained by `organizationId`, or enforce org match before deleting sessions.

---

### 4) Medium — Audit logs store full request bodies including sensitive data

**What happens**
- Several routes pass `body` directly into audit log changes, including patient `notes` and schedule/session `notes`.

**Impact**
- Audit logs can become a secondary store of PHI/PII, increasing breach and retention risk.

**Key code references**
- Patient create/update logs full body: `backend/src/routes/patients.ts:91`
- Session create/update logs full body: `backend/src/routes/schedules.ts:293`

**Fix**
- Create an allowlist of audit fields per entity (exclude `notes`, identifiers, transcripts).
- Consider hashing or redacting sensitive values.

---

### 5) Medium — Voice transcripts are logged to console

**What happens**
- Voice parsing logs the transcript verbatim.

**Impact**
- Transcripts may contain sensitive data; logs may be shipped/retained externally.

**Key code reference**
- `backend/src/routes/voice.ts:42`

**Fix**
- Remove transcript logging or log only metadata (length, context, requestId).

---

### 6) Medium — OpenAI prompt includes more patient/staff detail (privacy)

**What happens**
- Schedule generation sends staff, patients (including identifier), and room details to OpenAI.
- OpenAI calls include `store: false` (good), but the prompt content still contains PII.

**Key code references**
- Schedule generation prompt includes patient identifier and room preferences: `backend/src/services/openai.ts:44`, `backend/src/services/openai.ts:155`
- `store: false`: `backend/src/services/openai.ts:200`

**Fix**
- Minimize or pseudonymize data sent to OpenAI where possible.
- Ensure contractual/BAA and data retention policies align with regulated data requirements.

---

### 7) High (Operational) — Plaintext secrets in `terraform.tfvars`

**What happens**
- `infrastructure/terraform-demo/terraform.tfvars` and `infrastructure/terraform-shared/terraform.tfvars` contain plaintext JWT secrets, OpenAI keys, and DB passwords.
- Demo tfvars also includes what appears to be IAM access key material in comments.

**Key references**
- `infrastructure/terraform-demo/terraform.tfvars:9`
- `infrastructure/terraform-demo/terraform.tfvars:11`
- `infrastructure/terraform-demo/terraform.tfvars:30`
- `infrastructure/terraform-shared/terraform.tfvars:22`

**Fix**
- Treat these values as compromised if they were ever committed or shared.
- Rotate: JWT secret, OpenAI keys, DB password, and any IAM credentials.
- Replace tfvars with `terraform.tfvars.example` + use:
  - Terraform Cloud/Workspace variables, or
  - SSM Parameter Store/Secrets Manager, or
  - CI/CD secrets (GitHub Actions secrets) injected at deploy time.

## Proposed Fix Plan (Scheduling)

### P0 — Tenant isolation enforcement (app-layer)
- [ ] Add a single middleware/guard that binds tenant context to the authenticated user:
  - Non-super-admin: enforce `ctx.user.organizationId` and reject host-org mismatch.
  - Super-admin: explicitly decide behavior (allow specifying target org via header/param and audit it).
- [ ] Add tests that prove JWT(org A)+Host(org B) is rejected.

Suggested implementation locations:
- `backend/src/middleware/auth.ts` or a new `backend/src/middleware/tenant.ts` hook
- Applied globally in `backend/src/server.ts` after `organizationMiddleware`

### P0 — Session reference validation
- [ ] On session create/update, validate that staff/patient/room belong to schedule’s org.
- [ ] Update schedule read paths if needed to prevent leaking joined names for mismatched references.

### P1 — Data minimization / logging
- [ ] Remove transcript logging (`backend/src/routes/voice.ts`).
- [ ] Sanitize audit log `changes` payloads (exclude `notes`, `identifier`, transcripts).
- [ ] Review OpenAI prompts to reduce identifiers and other sensitive fields.

### P1 — Infrastructure secret hygiene
- [ ] Remove secrets from `*.tfvars` in the repo; use `.tfvars.example` patterns.
- [ ] Rotate any exposed secrets and confirm git history is clean.

## Notes / Constraints
- This report is based on static code review of the current workspace state.
- I could not verify whether the tfvars files are committed in git from this environment, but the contents warrant treating them as sensitive regardless.
