# Say It Schedule - Hybrid Practice Management Project Plan

**Version:** 2.0
**Date:** December 31, 2024
**Status:** Approved for Development

---

## Executive Summary

This document outlines the project plan for evolving Say It Schedule from a scheduling-focused application into a hybrid practice management solution. The strategy is to build best-in-class scheduling with selective high-value features while integrating with existing PMS/EHR systems for complex domains like billing and clinical documentation.

### Strategic Positioning

**"The AI-powered scheduling layer that works with your existing practice management system - or stands alone for practices that need smart scheduling without the complexity."**

### Key Differentiators

1. **Voice-First Scheduling** - AI-powered voice commands for all scheduling operations
2. **Patient/Caregiver Portal** - Self-service appointment management reduces admin burden
3. **Smart Reminders** - Multi-channel reminders with confirmation tracking
4. **Integration-Ready** - Works alongside existing PMS/EHR systems

---

## Project Phases Overview

| Phase | Focus | Timeline | Status |
|-------|-------|----------|--------|
| Phase 1 | Complete Scheduling Product + Patient Portal | Q1-Q2 2025 | Planning |
| Phase 2 | Strategic Integrations | Q3-Q4 2025 | Future |
| Phase 3 | Evaluate Full PMS | 2026 | Future |

---

## Phase 1: Complete Scheduling Product

### Objective

Transform the current scheduling tool into a complete, commercially-viable scheduling solution with patient/caregiver self-service capabilities.

### Timeline: 6 Months (Q1-Q2 2025)

### Sprint Structure

| Sprint | Duration | Focus Area |
|--------|----------|------------|
| Sprint 1 | 2 weeks | Foundation: Session Status + Org Settings |
| Sprint 2 | 2 weeks | Patient Contacts + Business Hours |
| Sprint 3 | 3 weeks | Background Jobs + Email Reminders |
| Sprint 4 | 2 weeks | SMS Reminders + Opt-out Management |
| Sprint 5 | 3 weeks | Patient Portal: Auth + View Appointments |
| Sprint 6 | 2 weeks | Patient Portal: Confirmations + Cancellations |
| Sprint 7 | 3 weeks | Reporting & Analytics |
| Sprint 8 | 2 weeks | Coverage, Conflicts, Swap |
| Sprint 9 | 2 weeks | Staff Self-Service + Polish |
| Sprint 10 | 1 week | Testing, Bug Fixes, Launch Prep |

**Total: 24 weeks (6 months)**

---

## Sprint 1: Foundation (Weeks 1-2)

### 1.1 Session Status Tracking

**Priority:** Critical

#### Data Model Changes

```prisma
// Add to Session model
model Session {
  // ... existing fields ...

  // Status tracking
  status            SessionStatus @default(scheduled)
  actualStartTime   DateTime?
  actualEndTime     DateTime?
  statusUpdatedAt   DateTime?
  statusUpdatedBy   String?

  // Cancellation details
  cancellationReason  CancellationReason?
  cancellationNotes   String?
  cancelledAt         DateTime?
  cancelledBy         String?

  statusUpdater     User?   @relation("SessionStatusUpdater", fields: [statusUpdatedBy], references: [id])
  canceller         User?   @relation("SessionCanceller", fields: [cancelledBy], references: [id])
}

enum SessionStatus {
  scheduled
  confirmed      // Patient confirmed attendance
  checked_in
  in_progress
  completed
  cancelled
  late_cancel
  no_show
}

enum CancellationReason {
  patient_request
  caregiver_request
  therapist_unavailable
  weather
  illness
  scheduling_conflict
  other
}
```

#### API Endpoints

```
PATCH /schedules/:scheduleId/sessions/:sessionId/status
  Body: { status: SessionStatus, reason?: CancellationReason, notes?: string }
  Auth: Admin, Staff (own sessions only)

POST /schedules/:scheduleId/sessions/:sessionId/check-in
  Body: { actualStartTime?: string }
  Auth: Admin, Staff (own sessions only)

POST /schedules/:scheduleId/sessions/:sessionId/check-out
  Body: { actualEndTime?: string, notes?: string }
  Auth: Admin, Staff (own sessions only)

POST /schedules/:scheduleId/sessions/:sessionId/cancel
  Body: { reason: CancellationReason, notes?: string }
  Auth: Admin only
```

#### Voice Commands

- "Mark John's 9am session as complete"
- "Patient Sarah cancelled her 2pm appointment"
- "Check in Emily for her session"
- "Mark the 10am session as no-show"
- "The 3pm session was a late cancellation due to illness"

#### UI Requirements

- Session cards display status badge (color-coded by status)
- Quick-action dropdown/buttons for status changes
- Cancellation modal with reason selection and notes
- Status history timeline on session detail view
- Filter sessions by status on schedule views

#### Acceptance Criteria

- [ ] Sessions can transition through all status states
- [ ] Cancellation captures reason, notes, timestamp, and user
- [ ] Late cancellations auto-detected based on org settings
- [ ] Staff can only update their own sessions
- [ ] All status changes logged to audit trail
- [ ] Voice commands work for status updates

---

### 1.2 Organization Settings Model

**Priority:** Critical (Foundation for other features)

#### Data Model

```prisma
model OrganizationSettings {
  id                    String   @id @default(cuid())
  organizationId        String   @unique
  organization          Organization @relation(fields: [organizationId], references: [id])

  // Business Hours (JSON structure)
  // { monday: { open: true, start: "08:00", end: "18:00" }, tuesday: {...}, ... }
  businessHours         Json     @default("{}")
  timezone              String   @default("America/New_York")

  // Session Defaults
  defaultSessionDuration Int     @default(60)  // minutes
  slotInterval          Int      @default(30)  // scheduling grid interval in minutes

  // Cancellation Policy
  lateCancelWindowHours Int      @default(24)
  allowPatientCancel    Boolean  @default(true)
  allowPatientReschedule Boolean @default(false)  // Phase 1: cancel only

  // Labels/Terminology
  staffLabel            String   @default("Therapists")
  staffLabelSingular    String   @default("Therapist")
  patientLabel          String   @default("Patients")
  patientLabelSingular  String   @default("Patient")

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model OrganizationFeatures {
  id                    String   @id @default(cuid())
  organizationId        String   @unique
  organization          Organization @relation(fields: [organizationId], references: [id])

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE TOGGLES - Control access to premium/optional features
  // These can be enabled per organization for tiered pricing
  // ═══════════════════════════════════════════════════════════════════

  // ─── Reminder Features ───
  emailRemindersEnabled Boolean  @default(true)   // Basic tier: included
  smsRemindersEnabled   Boolean  @default(false)  // Premium tier: per-message or included
  reminderHours         Json     @default("[24, 2]")  // Configurable reminder times

  // ─── Patient/Caregiver Portal ───
  patientPortalEnabled  Boolean  @default(false)  // Premium tier feature
  portalAllowCancel     Boolean  @default(true)   // If portal enabled, can patients cancel?
  portalAllowReschedule Boolean  @default(false)  // Future: allow rescheduling
  portalRequireConfirmation Boolean @default(true) // Require patients to confirm appointments

  // ─── Reporting Features ───
  advancedReportsEnabled Boolean @default(false)  // Premium tier: full analytics
  reportExportEnabled   Boolean  @default(true)   // CSV/PDF export

  // ─── Voice Features ───
  voiceCommandsEnabled  Boolean  @default(true)   // Core feature: included
  medicalTranscribeEnabled Boolean @default(false) // HIPAA-compliant transcription (AWS)

  // ─── Integration Features (Phase 2) ───
  apiAccessEnabled      Boolean  @default(false)  // Allow API integrations
  webhooksEnabled       Boolean  @default(false)  // Outbound webhooks

  // ─── Limits ───
  maxStaff              Int?     // null = unlimited
  maxPatients           Int?     // null = unlimited
  maxRemindersPerMonth  Int?     // null = unlimited, or cap for SMS costs

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

#### API Endpoints

```
GET /organizations/:id/settings
  Auth: Admin

PUT /organizations/:id/settings
  Body: Partial<OrganizationSettings>
  Auth: Admin
```

#### UI Requirements

- Settings page section for business hours (day-by-day)
- Timezone selector
- Session duration and slot interval configuration
- Cancellation policy settings
- Toggle switches for portal features
- Label customization inputs

#### Acceptance Criteria

- [ ] Organization settings created automatically on org creation
- [ ] Business hours configurable per day
- [ ] Settings accessible only to admins
- [ ] Schedule page respects business hours
- [ ] AI generation uses configured hours

---

## Sprint 2: Patient Contacts + Business Hours (Weeks 3-4)

### 2.1 Patient Contacts Model

**Priority:** Critical (Required for reminders and portal)

#### Data Model

```prisma
model PatientContact {
  id                  String      @id @default(cuid())
  patientId           String
  patient             Patient     @relation(fields: [patientId], references: [id], onDelete: Cascade)

  // Contact info
  contactType         ContactType
  relationship        String?     // "Mother", "Father", "Self", "Guardian", etc.
  name                String
  email               String?
  phone               String?

  // Preferences
  isPrimary           Boolean     @default(false)
  emailReminders      Boolean     @default(true)
  smsReminders        Boolean     @default(true)
  canAccessPortal     Boolean     @default(true)
  canCancelAppointments Boolean   @default(true)

  // Portal access (if enabled)
  portalUserId        String?     @unique
  portalUser          User?       @relation(fields: [portalUserId], references: [id])

  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  @@index([patientId])
}

enum ContactType {
  self        // Patient is their own contact (adult patients)
  parent
  guardian
  caregiver
  spouse
  other
}
```

#### API Endpoints

```
GET /patients/:patientId/contacts
  Auth: Admin, Staff

POST /patients/:patientId/contacts
  Body: { contactType, relationship?, name, email?, phone?, ... }
  Auth: Admin

PUT /patients/:patientId/contacts/:contactId
  Body: Partial<PatientContact>
  Auth: Admin

DELETE /patients/:patientId/contacts/:contactId
  Auth: Admin

POST /patients/:patientId/contacts/:contactId/invite-to-portal
  Auth: Admin
  Response: { inviteLink, expiresAt }
```

#### UI Requirements

- Contact list on patient profile page
- Add/edit contact modal
- Primary contact indicator
- Portal access toggle per contact
- Reminder preference toggles
- "Invite to Portal" button

#### Acceptance Criteria

- [ ] Multiple contacts per patient supported
- [ ] One primary contact enforced
- [ ] Contact preferences stored correctly
- [ ] Portal invitation flow works
- [ ] Contacts cascade delete with patient

---

### 2.2 Configurable Business Hours UI

**Priority:** Medium

#### UI Requirements

- Visual business hours editor
- Toggle open/closed per day
- Start/end time pickers
- Copy hours to multiple days
- Preview schedule grid with configured hours
- Holiday/closure management (stretch goal)

#### Impact on Existing Features

- Schedule page time slots derived from settings
- AI generation prompt includes business hours
- Conflict detection flags sessions outside hours
- Patient portal shows only available slots

#### Acceptance Criteria

- [ ] Business hours editable from settings
- [ ] Schedule page reflects configured hours
- [ ] Time slot dropdowns use configured intervals
- [ ] Closed days blocked from scheduling

---

## Sprint 3: Background Jobs + Email Reminders (Weeks 5-7)

### 3.1 Background Job Infrastructure

**Priority:** Critical (Foundation for reminders)

#### Technology Selection

**Recommended: BullMQ + Redis**

- Industry-standard Node.js job queue
- Reliable job persistence
- Built-in retry logic
- Job scheduling (delayed jobs)
- Dashboard for monitoring (Bull Board)

#### Infrastructure Changes

```yaml
# docker-compose.yml additions
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

#### Job Types

```typescript
// Job definitions
interface ReminderJob {
  type: 'send_reminder'
  sessionId: string
  contactId: string
  reminderType: 'email' | 'sms'
  scheduledFor: Date
}

interface ConfirmationCheckJob {
  type: 'check_confirmation'
  sessionId: string
  escalateTo: 'admin' | 'none'
}

interface PortalInviteJob {
  type: 'send_portal_invite'
  contactId: string
  inviteToken: string
}
```

#### Scheduler Service

```typescript
// Runs every 15 minutes
async function scheduleReminders() {
  // Find sessions in upcoming reminder windows
  // Create reminder jobs for each session/contact
  // Skip if reminder already sent
}
```

#### Acceptance Criteria

- [ ] Redis container running in development
- [ ] BullMQ queues configured
- [ ] Bull Board dashboard accessible (admin only)
- [ ] Job retry logic working
- [ ] Failed jobs logged and alertable

---

### 3.2 Email Reminder System

**Priority:** Critical

#### Data Model

```prisma
model ReminderLog {
  id                String         @id @default(cuid())
  sessionId         String
  session           Session        @relation(fields: [sessionId], references: [id])

  contactId         String
  contact           PatientContact @relation(fields: [contactId], references: [id])

  reminderType      ReminderType
  hoursBeforeSession Int
  scheduledFor      DateTime
  sentAt            DateTime?
  status            ReminderStatus @default(pending)
  errorMessage      String?

  // Response tracking
  openedAt          DateTime?
  confirmedAt       DateTime?
  actionTaken       String?        // "confirmed", "cancelled", "rescheduled"

  createdAt         DateTime       @default(now())

  @@index([sessionId])
  @@index([status, scheduledFor])
}

enum ReminderType {
  email
  sms
}

enum ReminderStatus {
  pending
  sent
  delivered
  failed
  cancelled
}
```

#### Email Template

```html
Subject: Reminder: Appointment on [Date] at [Time]

- Organization branding (logo, colors)
- Patient name
- Appointment date and time
- Therapist name
- Location/Room
- "Confirm Appointment" button → Portal link or magic link
- "Cancel Appointment" button → Portal link or magic link
- Organization contact info
- Cancellation policy notice
```

#### API Endpoints

```
GET /reminders
  Query: { status?, sessionId?, startDate?, endDate? }
  Auth: Admin

POST /reminders/:id/resend
  Auth: Admin

GET /reminders/:id/track/open
  Auth: Public (tracking pixel)

POST /reminders/:id/confirm
  Auth: Magic link token
```

#### Acceptance Criteria

- [ ] Reminders scheduled automatically for new sessions
- [ ] Email sent at configured intervals (default: 24h, 2h)
- [ ] Email includes organization branding
- [ ] Open tracking working
- [ ] Confirm action updates session status
- [ ] Cancel action triggers cancellation flow
- [ ] Reminders cancelled when session cancelled

---

## Sprint 4: SMS Reminders + Opt-out (Weeks 8-9)

### 4.1 SMS Reminder System

**Priority:** High

#### Provider Selection

**Recommended: Twilio**

- Reliable delivery
- Good documentation
- HIPAA-eligible (BAA available)
- Reasonable pricing (~$0.0079/message)

#### SMS Template

```
[OrgName]: Reminder - [PatientName] has an appt on [Date] at [Time] with [Therapist].
Reply C to confirm, X to cancel, STOP to opt out.
```

#### Inbound Message Handling

```typescript
// Webhook handler for Twilio
POST /webhooks/twilio/inbound
  - Parse reply: C = confirm, X = cancel, STOP = opt out
  - Update session status or contact preferences
  - Send acknowledgment message
```

#### Acceptance Criteria

- [ ] SMS sent at configured intervals
- [ ] Reply handling works (C/X/STOP)
- [ ] Opt-out immediately stops SMS
- [ ] TCPA compliance (opt-out honored)
- [ ] SMS logs stored for audit

---

### 4.2 Opt-out Management

**Priority:** High (Compliance requirement)

#### Features

- Email unsubscribe link in all emails
- SMS STOP keyword handling
- Per-contact opt-out preferences
- Admin view of opt-out status
- Cannot override patient opt-out

#### API Endpoints

```
POST /contacts/:contactId/opt-out
  Body: { type: 'email' | 'sms' | 'all' }
  Auth: Public (with token) or Admin

GET /opt-outs
  Query: { organizationId }
  Auth: Admin
```

#### Acceptance Criteria

- [ ] Opt-out links work without login
- [ ] STOP keyword processes correctly
- [ ] Opted-out contacts don't receive reminders
- [ ] Audit trail for opt-out actions

---

## Sprint 5: Patient Portal - Core (Weeks 10-12)

### 5.1 Portal Authentication

**Priority:** Critical

#### Authentication Flow

```
1. Contact invited to portal (by admin or via reminder link)
2. Magic link sent to email/SMS
3. Click link → Set password (optional) or passwordless session
4. Future access: Email + password OR magic link
```

#### Data Model Changes

```prisma
// Extend User model for portal users
model User {
  // ... existing fields ...

  userType          UserType      @default(staff)
  linkedContactId   String?       @unique
  linkedContact     PatientContact? @relation(fields: [linkedContactId], references: [id])
}

enum UserType {
  super_admin
  admin
  admin_assistant
  staff
  portal_user      // NEW: Patient/caregiver portal access
}

model PortalSession {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  token           String   @unique
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  @@index([token])
  @@index([expiresAt])
}

model MagicLink {
  id              String   @id @default(cuid())
  contactId       String
  contact         PatientContact @relation(fields: [contactId], references: [id])
  token           String   @unique
  purpose         MagicLinkPurpose
  expiresAt       DateTime
  usedAt          DateTime?
  createdAt       DateTime @default(now())

  @@index([token])
}

enum MagicLinkPurpose {
  portal_login
  confirm_appointment
  cancel_appointment
  set_password
}
```

#### API Endpoints

```
POST /portal/auth/request-magic-link
  Body: { email: string }
  Response: { message: "Check your email" }

POST /portal/auth/verify-magic-link
  Body: { token: string }
  Response: { accessToken, user, linkedPatients }

POST /portal/auth/login
  Body: { email, password }
  Response: { accessToken, user, linkedPatients }

POST /portal/auth/logout
  Auth: Portal user

GET /portal/me
  Auth: Portal user
  Response: { user, linkedPatients, contacts }
```

#### Security Considerations

- Magic links expire in 15 minutes
- Portal sessions expire in 7 days (configurable)
- Portal users isolated from staff data
- Can only see their linked patient(s)
- Rate limiting on magic link requests

#### Acceptance Criteria

- [ ] Magic link login works
- [ ] Password-based login works (optional)
- [ ] Portal users can only see their patients
- [ ] Session management working
- [ ] Rate limiting prevents abuse

---

### 5.2 Portal - View Appointments

**Priority:** Critical

#### Features

- List upcoming appointments for linked patient(s)
- View appointment details (date, time, therapist, location)
- See appointment status
- View past appointments (last 30 days)

#### API Endpoints

```
GET /portal/appointments
  Query: { patientId?, status?, startDate?, endDate? }
  Auth: Portal user
  Response: { appointments: [...], patients: [...] }

GET /portal/appointments/:sessionId
  Auth: Portal user (must be linked to patient)
  Response: { appointment, patient, therapist, location }
```

#### UI Requirements (Portal)

**Note: Portal is a separate Vue app or route group**

- Clean, mobile-first design
- Organization branding applied
- Appointment cards with key info
- Status badges (Upcoming, Confirmed, Completed, Cancelled)
- Pull-to-refresh on mobile
- Calendar view toggle (stretch goal)

#### Page: Upcoming Appointments

```
[Organization Logo]

Welcome, [Contact Name]

Upcoming Appointments for [Patient Name]
─────────────────────────────────────────

┌─────────────────────────────────────┐
│ Tuesday, January 14, 2025           │
│ 10:00 AM - 11:00 AM                 │
│ with Sarah Johnson                  │
│ Room: Therapy Room A                │
│                                     │
│ Status: ⏳ Awaiting Confirmation    │
│                                     │
│ [Confirm] [Cancel Appointment]      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Thursday, January 16, 2025          │
│ 2:00 PM - 3:00 PM                   │
│ with Sarah Johnson                  │
│ Room: Therapy Room B                │
│                                     │
│ Status: ✓ Confirmed                 │
│                                     │
│ [Cancel Appointment]                │
└─────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] Portal user can view their appointments
- [ ] Only sees appointments for linked patient(s)
- [ ] Appointment details are accurate
- [ ] Past appointments visible
- [ ] Mobile-responsive design

---

## Sprint 6: Portal - Confirmations + Cancellations (Weeks 13-14)

### 6.1 Appointment Confirmation

**Priority:** High

#### Flow

```
1. Reminder sent with "Confirm" link/button
2. Patient clicks → Portal (or magic link action)
3. Confirmation recorded
4. Session status → "confirmed"
5. Admin notified (optional)
```

#### API Endpoints

```
POST /portal/appointments/:sessionId/confirm
  Auth: Portal user OR magic link token
  Response: { success, appointment }

GET /confirm/:token
  Auth: Public (magic link)
  Action: Confirm and redirect to portal
```

#### UI Requirements

- Confirm button on appointment card
- Success confirmation message
- Status updates to "Confirmed"
- Option to add note (stretch goal)

#### Admin View

- Dashboard widget: "Awaiting Confirmation" count
- Filter appointments by confirmation status
- "Send Reminder" button for unconfirmed

#### Acceptance Criteria

- [ ] Confirm via portal works
- [ ] Confirm via magic link works
- [ ] Session status updates to "confirmed"
- [ ] Audit log records confirmation
- [ ] Admin can see unconfirmed appointments

---

### 6.2 Patient-Initiated Cancellation

**Priority:** High

#### Flow

```
1. Patient clicks "Cancel" in portal or reminder
2. Cancellation reason selection (simplified list)
3. Confirmation: "Are you sure?"
4. Cancellation recorded
5. Session status → "cancelled" or "late_cancel"
6. Admin notified
7. Cancellation confirmation sent to patient
```

#### Business Rules

- Check if within late-cancel window
- Respect organization's `allowPatientCancel` setting
- If not allowed, show "Contact us to cancel" message
- Admin always notified of cancellations

#### API Endpoints

```
POST /portal/appointments/:sessionId/cancel
  Body: { reason: string, notes?: string }
  Auth: Portal user OR magic link token
  Response: { success, isLateCancel, appointment }

GET /cancel/:token
  Auth: Public (magic link)
  Action: Show cancel form, process, redirect
```

#### Cancellation Reasons (Patient-Facing)

```
- I'm not feeling well
- Schedule conflict
- Transportation issue
- Need to reschedule (future: offer reschedule)
- Other
```

#### UI Requirements

- Cancel button on appointment card
- Reason selection (required)
- Optional notes field
- Confirmation dialog
- Success message with confirmation details
- Show late-cancel warning if applicable

#### Acceptance Criteria

- [ ] Patient can cancel from portal
- [ ] Patient can cancel from magic link
- [ ] Late cancellation detected correctly
- [ ] Reason captured
- [ ] Admin notified
- [ ] Confirmation sent to patient

---

## Sprint 7: Reporting & Analytics (Weeks 15-17)

### 7.1 Report Types

**Priority:** High

#### 1. Staff Utilization Report

```
Metrics:
- Hours scheduled vs. hours available
- Utilization percentage
- Sessions completed vs. scheduled
- Comparison across staff

Filters:
- Date range
- Staff member
- Day of week

Visualizations:
- Bar chart: Utilization by staff
- Line chart: Trend over weeks
- Table: Detailed breakdown
```

#### 2. Patient Attendance Report

```
Metrics:
- Sessions scheduled vs. completed
- No-show rate
- Late cancellation rate
- Confirmation rate
- Sessions vs. prescribed frequency

Filters:
- Date range
- Patient
- Therapist

Visualizations:
- Pie chart: Session outcomes
- Table: Patient-level details
- Alert list: Patients under-scheduled
```

#### 3. Cancellation Analysis Report

```
Metrics:
- Cancellation rate by period
- Reasons breakdown
- Late vs. advance cancellations
- Cancellation by day of week
- Patterns by patient/therapist

Filters:
- Date range
- Cancellation type
- Reason

Visualizations:
- Pie chart: Reasons
- Bar chart: By day of week
- Trend line: Rate over time
```

#### 4. Schedule Coverage Report

```
Metrics:
- Patients receiving required frequency
- Under-scheduled patients list
- Over-scheduled patients list
- Open slots by day/therapist

Filters:
- Week
- Therapist

Visualizations:
- Coverage percentage gauge
- Table: Under-scheduled patients
- Heatmap: Slot availability
```

#### 5. Reminder Effectiveness Report

```
Metrics:
- Reminders sent vs. opened
- Confirmation rate from reminders
- Cancellation rate from reminders
- Channel comparison (email vs. SMS)

Filters:
- Date range
- Reminder type
- Hours before session

Visualizations:
- Funnel: Sent → Opened → Confirmed
- Bar chart: Channel comparison
```

### 7.2 API Endpoints

```
GET /reports/staff-utilization
  Query: { startDate, endDate, staffId? }

GET /reports/patient-attendance
  Query: { startDate, endDate, patientId?, therapistId? }

GET /reports/cancellations
  Query: { startDate, endDate, groupBy? }

GET /reports/schedule-coverage
  Query: { weekStartDate }

GET /reports/reminder-effectiveness
  Query: { startDate, endDate }

GET /reports/export/:reportType
  Query: { format: 'csv' | 'pdf', ...filters }
```

### 7.3 UI Requirements

- New "Reports" section in navigation (Admin only)
- Report selector/tabs
- Date range picker (common component)
- Filter controls per report type
- Chart visualizations (recommend: Chart.js or Apache ECharts)
- Data tables with sorting and pagination
- Export buttons (CSV, PDF)

### 7.4 Dashboard Integration

Update main dashboard with:
- Utilization percentage widget
- No-show rate widget
- Unconfirmed appointments count
- Patients under-scheduled alert
- Quick links to full reports

#### Acceptance Criteria

- [ ] All 5 report types implemented
- [ ] Filters working correctly
- [ ] Charts rendering properly
- [ ] CSV export working
- [ ] PDF export working
- [ ] Dashboard widgets updated

---

## Sprint 8: Coverage, Conflicts, Swap (Weeks 18-19)

### 8.1 Coverage Rate Calculation

**Priority:** Medium

#### Implementation

```typescript
interface CoverageResult {
  coverageRate: number        // 0-100
  totalActivePatients: number
  fullyScheduled: number
  underScheduled: Array<{
    patient: Patient
    required: number
    scheduled: number
    deficit: number
  }>
  overScheduled: Array<{
    patient: Patient
    required: number
    scheduled: number
    surplus: number
  }>
}
```

#### API Endpoint

```
GET /schedules/:id/coverage
  Response: CoverageResult
```

#### UI Integration

- Coverage percentage on schedule page
- Under-scheduled patients list (expandable)
- Visual indicator on patient sessions

---

### 8.2 Conflict Detection Enhancement

**Priority:** Medium

#### Conflict Types

```typescript
interface Conflict {
  type: 'therapist_double_booked' | 'patient_double_booked' |
        'room_double_booked' | 'outside_business_hours' |
        'on_closed_day' | 'therapist_unavailable'
  severity: 'error' | 'warning'
  sessionId: string
  description: string
  resolution?: string  // Suggested fix
}
```

#### API Endpoint

```
GET /schedules/:id/conflicts
  Response: { count: number, conflicts: Conflict[] }
```

#### UI Integration

- Conflict count badge on schedule
- Conflict panel (slideover or modal)
- Click conflict → Navigate to session
- Conflict indicator on session cards

---

### 8.3 Swap Session Implementation

**Priority:** Medium

Complete the unimplemented swap functionality.

#### API Endpoint

```
POST /schedules/:id/sessions/swap
  Body: { session1Id: string, session2Id: string }
  Response: { success, session1, session2 }
```

#### Voice Commands

- "Swap John's 9am session with his 2pm session"
- "Swap Monday and Tuesday for therapist Sarah"

#### Logic

1. Validate both sessions exist in schedule
2. Swap: date, startTime, endTime
3. Check for conflicts after swap
4. If conflicts, reject with details
5. If clean, commit swap
6. Audit log both changes

---

## Sprint 9: Staff Self-Service + Polish (Weeks 20-21)

### 9.1 Staff Self-Service Enhancements

**Priority:** Low-Medium

#### Features

**Default Hours Update Request:**
- Staff can propose changes to their default hours
- Request goes to admin for approval
- Or direct edit if `allowStaffEditHours` setting enabled

**Historical Sessions View:**
- New "Past Sessions" tab on My Schedule
- Filter by date range
- See all statuses (completed, cancelled, no-show)
- Personal statistics summary

**Personal Dashboard Widgets:**
- Sessions this week
- Completion rate
- Upcoming time-off

### 9.2 Voice Command Enhancements

Review and enhance voice commands for new features:
- Session status updates
- Portal-related queries ("Who hasn't confirmed?")
- Report generation ("Show me last week's cancellations")

### 9.3 UI Polish

- Loading states consistency
- Error message improvements
- Mobile responsiveness audit
- Accessibility improvements (ARIA, keyboard nav)
- Dark mode support (stretch goal)

---

## Sprint 10: Testing + Launch Prep (Weeks 22-24)

### 10.1 Testing

#### Unit Tests

- All new services
- All new repositories
- Business logic (cancellation policy, coverage calc)

#### Integration Tests

- API endpoints
- Background jobs
- Email/SMS delivery (sandbox)
- Portal authentication flow

#### E2E Tests

- Critical user flows
- Portal appointment confirmation
- Portal cancellation
- Reminder delivery
- Report generation

### 10.2 Documentation

- API documentation update
- User guide for new features
- Portal user guide
- Admin configuration guide

### 10.3 Deployment Prep

- Environment variables for new services
- Redis deployment (AWS ElastiCache or container)
- Twilio account setup (production)
- Monitoring dashboards
- Alert configuration

### 10.4 Launch Checklist

- [ ] All tests passing
- [ ] Performance testing complete
- [ ] Security review complete
- [ ] Documentation complete
- [ ] Monitoring in place
- [ ] Rollback plan documented
- [ ] Customer communication ready

---

## Feature Toggle System

### Overview

Customer-facing features are controlled by the `OrganizationFeatures` model, allowing:
- **Tiered pricing** - Basic vs. Premium plans
- **Gradual rollout** - Enable features for beta customers first
- **Usage-based billing** - Track and limit SMS usage
- **Custom packages** - Mix and match features per customer

### Feature Tiers (Suggested)

| Feature | Basic | Professional | Enterprise |
|---------|-------|--------------|------------|
| Core Scheduling | ✓ | ✓ | ✓ |
| Voice Commands | ✓ | ✓ | ✓ |
| Email Reminders | ✓ | ✓ | ✓ |
| SMS Reminders | - | ✓ | ✓ |
| Patient Portal | - | ✓ | ✓ |
| Basic Reports | ✓ | ✓ | ✓ |
| Advanced Reports | - | ✓ | ✓ |
| Report Export (CSV/PDF) | - | ✓ | ✓ |
| API Access | - | - | ✓ |
| Webhooks | - | - | ✓ |
| HIPAA Transcription | - | - | ✓ |
| Staff Limit | 5 | 25 | Unlimited |
| Patient Limit | 50 | 250 | Unlimited |

### Implementation Pattern

#### Backend: Feature Guard Middleware

```typescript
// middleware/featureGuard.ts
import { OrganizationFeatures } from '@prisma/client'

export function requireFeature(feature: keyof OrganizationFeatures) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const features = await getOrganizationFeatures(request.organizationId)

    if (!features[feature]) {
      return reply.status(403).send({
        error: 'Feature not available',
        feature,
        message: 'This feature is not included in your current plan. Please upgrade to access it.',
        upgradeUrl: '/settings/billing'
      })
    }
  }
}

// Usage in routes
app.get('/portal/appointments', {
  preHandler: [authenticate, requireFeature('patientPortalEnabled')]
}, handler)

app.post('/reminders/sms', {
  preHandler: [authenticate, requireFeature('smsRemindersEnabled')]
}, handler)
```

#### Backend: Feature Check Service

```typescript
// services/features.ts
export class FeatureService {
  async isEnabled(organizationId: string, feature: string): Promise<boolean> {
    const features = await this.getFeatures(organizationId)
    return features[feature] === true
  }

  async checkLimit(organizationId: string, limitType: 'staff' | 'patients' | 'reminders'): Promise<{
    allowed: boolean
    current: number
    limit: number | null
    message?: string
  }> {
    const features = await this.getFeatures(organizationId)
    const current = await this.getCurrentCount(organizationId, limitType)
    const limit = features[`max${capitalize(limitType)}`]

    if (limit === null) return { allowed: true, current, limit }

    return {
      allowed: current < limit,
      current,
      limit,
      message: current >= limit
        ? `You have reached your ${limitType} limit (${limit}). Please upgrade your plan.`
        : undefined
    }
  }

  async getFeatures(organizationId: string): Promise<OrganizationFeatures> {
    // Cache features for performance (invalidate on update)
    return this.cache.getOrSet(`features:${organizationId}`, async () => {
      return prisma.organizationFeatures.findUnique({
        where: { organizationId }
      }) ?? this.getDefaultFeatures()
    })
  }
}
```

#### Frontend: Feature Flag Composable

```typescript
// composables/useFeatures.ts
export function useFeatures() {
  const authStore = useAuthStore()
  const features = ref<OrganizationFeatures | null>(null)
  const loading = ref(true)

  const isEnabled = (feature: keyof OrganizationFeatures): boolean => {
    return features.value?.[feature] === true
  }

  const hasPortal = computed(() => isEnabled('patientPortalEnabled'))
  const hasSmsReminders = computed(() => isEnabled('smsRemindersEnabled'))
  const hasAdvancedReports = computed(() => isEnabled('advancedReportsEnabled'))

  // Load features on mount
  onMounted(async () => {
    features.value = await api.getOrganizationFeatures()
    loading.value = false
  })

  return {
    features,
    loading,
    isEnabled,
    hasPortal,
    hasSmsReminders,
    hasAdvancedReports
  }
}
```

#### Frontend: Feature Gate Component

```vue
<!-- components/FeatureGate.vue -->
<template>
  <slot v-if="enabled" />
  <slot v-else name="upgrade">
    <UpgradePrompt :feature="feature" />
  </slot>
</template>

<script setup lang="ts">
const props = defineProps<{
  feature: string
  showUpgrade?: boolean
}>()

const { isEnabled } = useFeatures()
const enabled = computed(() => isEnabled(props.feature))
</script>

<!-- Usage -->
<FeatureGate feature="patientPortalEnabled">
  <PatientPortalSettings />
  <template #upgrade>
    <div class="upgrade-banner">
      Patient Portal is available on Professional plans.
      <RouterLink to="/settings/billing">Upgrade Now</RouterLink>
    </div>
  </template>
</FeatureGate>
```

### API Endpoints for Features

```
GET /organizations/:id/features
  Auth: Admin, Super Admin
  Response: OrganizationFeatures

PUT /organizations/:id/features
  Auth: Super Admin only (or billing system webhook)
  Body: Partial<OrganizationFeatures>

GET /organizations/:id/usage
  Auth: Admin
  Response: {
    staff: { current: 12, limit: 25 },
    patients: { current: 87, limit: 250 },
    smsThisMonth: { current: 342, limit: 1000 }
  }
```

### Super Admin Feature Management

Super admins can toggle features for any organization:

```
/admin/organizations/:id/features
  - Toggle individual features
  - Apply preset tier (Basic/Professional/Enterprise)
  - Set custom limits
  - View usage statistics
```

### Feature Toggle Defaults by Tier

```typescript
// config/featureTiers.ts
export const FEATURE_TIERS = {
  basic: {
    emailRemindersEnabled: true,
    smsRemindersEnabled: false,
    patientPortalEnabled: false,
    advancedReportsEnabled: false,
    reportExportEnabled: false,
    voiceCommandsEnabled: true,
    medicalTranscribeEnabled: false,
    apiAccessEnabled: false,
    webhooksEnabled: false,
    maxStaff: 5,
    maxPatients: 50,
    maxRemindersPerMonth: null
  },
  professional: {
    emailRemindersEnabled: true,
    smsRemindersEnabled: true,
    patientPortalEnabled: true,
    advancedReportsEnabled: true,
    reportExportEnabled: true,
    voiceCommandsEnabled: true,
    medicalTranscribeEnabled: false,
    apiAccessEnabled: false,
    webhooksEnabled: false,
    maxStaff: 25,
    maxPatients: 250,
    maxRemindersPerMonth: 1000
  },
  enterprise: {
    emailRemindersEnabled: true,
    smsRemindersEnabled: true,
    patientPortalEnabled: true,
    advancedReportsEnabled: true,
    reportExportEnabled: true,
    voiceCommandsEnabled: true,
    medicalTranscribeEnabled: true,
    apiAccessEnabled: true,
    webhooksEnabled: true,
    maxStaff: null,
    maxPatients: null,
    maxRemindersPerMonth: null
  }
}
```

---

## Technical Architecture

### New Services

```
/backend/src/services/
  ├── reminder/
  │   ├── reminderScheduler.ts    # Schedules reminder jobs
  │   ├── reminderSender.ts       # Sends email/SMS
  │   └── reminderTracker.ts      # Tracks opens/clicks
  ├── portal/
  │   ├── portalAuth.ts           # Magic links, sessions
  │   ├── portalAppointments.ts   # Appointment queries
  │   └── portalActions.ts        # Confirm/cancel
  ├── reports/
  │   ├── utilizationReport.ts
  │   ├── attendanceReport.ts
  │   ├── cancellationReport.ts
  │   ├── coverageReport.ts
  │   └── exportService.ts        # CSV/PDF generation
  └── jobs/
      ├── queue.ts                # BullMQ setup
      ├── workers/
      │   ├── reminderWorker.ts
      │   ├── confirmationWorker.ts
      │   └── cleanupWorker.ts
      └── scheduler.ts            # Cron-like scheduling
```

### Frontend Structure

```
/frontend/src/
  ├── pages/
  │   ├── ReportsPage.vue
  │   ├── reports/
  │   │   ├── UtilizationReport.vue
  │   │   ├── AttendanceReport.vue
  │   │   ├── CancellationReport.vue
  │   │   └── CoverageReport.vue
  │   └── settings/
  │       ├── BusinessHoursSettings.vue
  │       ├── ReminderSettings.vue
  │       └── PortalSettings.vue
  │
  └── portal/                     # Separate portal app/routes
      ├── PortalLayout.vue
      ├── PortalLogin.vue
      ├── PortalAppointments.vue
      ├── PortalAppointmentDetail.vue
      └── PortalConfirmCancel.vue
```

### Database Schema Summary

```
New Models:
- OrganizationSettings    # Business hours, policies, labels
- OrganizationFeatures    # Feature toggles and limits (tiered pricing)
- PatientContact          # Multiple contacts per patient
- ReminderLog             # Track reminder delivery and responses
- PortalSession           # Portal user sessions
- MagicLink               # Passwordless authentication tokens

Modified Models:
- Session: status fields, cancellation fields
- User: userType, linkedContactId
- Patient: defaultSessionDuration
- Organization: relations to Settings and Features
```

---

## Success Metrics

### Phase 1 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session status adoption | >80% sessions updated | Weekly report |
| Reminder delivery rate | >95% successfully sent | Reminder logs |
| Email open rate | >40% | Tracking pixel |
| Confirmation rate | >60% from reminders | Reminder logs |
| No-show reduction | 20% decrease | Before/after comparison |
| Portal adoption | >30% of patients active | Portal logins |
| Report usage | >50% admins weekly | Feature analytics |
| Customer satisfaction | NPS > 40 | Survey |

### Business Metrics

| Metric | Target |
|--------|--------|
| Customer churn | 20% reduction |
| Trial conversion | 30% |
| Feature-driven upsell | 15% |

---

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| SMS costs exceed budget | Medium | Medium | Start with email-only, SMS as premium tier |
| Portal security breach | High | Low | Security review, penetration testing |
| Background job failures | High | Medium | Robust monitoring, alerting, dead letter queue |
| Reminder spam complaints | Medium | Medium | Clear opt-out, preference center |
| Scope creep | High | High | Strict sprint boundaries, defer to Phase 2 |
| Performance issues with reports | Medium | Medium | Caching, materialized views, pagination |

---

## Open Questions

1. **Portal branding** - Same domain with `/portal` or separate subdomain?
2. **SMS pricing model** - Included in base price or per-message?
3. **Caregiver multi-patient** - Can one caregiver manage multiple patients?
4. **Rescheduling** - Enable in Phase 1 or defer to Phase 2?
5. **Report retention** - How long to keep detailed historical data?

---

## Dependencies

### External Services

| Service | Purpose | Account Needed |
|---------|---------|----------------|
| Redis | Job queue | AWS ElastiCache or container |
| Twilio | SMS | Twilio account with HIPAA BAA |
| AWS SES | Email | Already configured |

### Libraries (New)

| Package | Purpose |
|---------|---------|
| bullmq | Job queue |
| ioredis | Redis client |
| twilio | SMS sending |
| chart.js or echarts | Report visualizations |
| pdfkit or puppeteer | PDF generation |

---

## Next Steps

1. **Review and approve this plan**
2. **Sprint 1 kickoff:**
   - Create Prisma migrations for Session status + OrganizationSettings
   - Implement session status API endpoints
   - Add session status UI components
3. **Infrastructure setup:**
   - Add Redis to docker-compose
   - Set up BullMQ scaffolding
4. **Establish baseline metrics** for success measurement

---

## Appendix A: Complete API Reference

See separate document: `api-reference-phase1.md` (to be created)

## Appendix B: Database Migration Plan

See separate document: `migration-plan-phase1.md` (to be created)

## Appendix C: Portal Wireframes

See separate document: `portal-wireframes.md` (to be created)

---

*Document Version 2.0 - Updated to include Patient Portal and sprint-based development plan.*
