# Say It Schedule - Scheduling Gap Analysis for Commercial Viability

**Version:** 1.0
**Date:** December 31, 2024
**Status:** Research Document

---

## Executive Summary

This document analyzes the current state of the scheduling functionality in Say It Schedule and identifies gaps that need to be addressed for commercial viability in the therapy/healthcare scheduling market. The analysis covers implemented features, critical gaps, shortcuts/technical debt, and prioritized recommendations.

---

## What's Already Implemented

### Core Scheduling

| Feature | Status | Notes |
|---------|--------|-------|
| AI-powered schedule generation | Complete | Uses AWS Nova or OpenAI |
| Weekly schedule management (draft/publish) | Complete | Version tracking included |
| Session CRUD operations | Complete | With conflict detection |
| Voice-powered schedule modifications | Complete | Move, cancel, create sessions |
| Rule-based constraints | Complete | 5 categories (gender, session, availability, pairing, certification) |
| Conflict detection | Complete | Therapist, patient, and room conflicts |
| PDF export with branding | Complete | Organization logo and colors |
| Multiple schedule views | Complete | Calendar, By Therapist, By Patient, By Room |

### Staff & Patient Management

| Feature | Status | Notes |
|---------|--------|-------|
| Staff profiles with certifications | Complete | Working hours, gender, contact info |
| Patient profiles with requirements | Complete | Session frequency, room needs, certification requirements |
| Voice-powered management | Complete | Add/update staff and patients via voice |
| Time-off request workflow | Complete | Staff request → Admin approve/reject |
| Staff availability management | Complete | Default hours + date-specific overrides |

### Multi-Tenancy & Security

| Feature | Status | Notes |
|---------|--------|-------|
| Organization isolation | Complete | All data scoped by organizationId |
| Role-based access control | Complete | Super Admin, Admin, Admin Assistant, Staff |
| Audit logging | Complete | All schedule/session/rule changes logged |
| MFA for super admins | Complete | TOTP-based |
| HIPAA BAA workflow | Complete | Digital signature capture |
| AWS Medical Transcribe | Complete | HIPAA-compliant voice transcription |

### Email Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| Schedule published notification | Complete | Sent to all staff |
| Time-off request submitted | Complete | Sent to admins |
| Time-off approved/rejected | Complete | Sent to staff member |
| User invitation emails | Complete | With password setup link |
| Password reset emails | Complete | Standard flow |

---

## Critical Gaps for Commercial Viability

### 1. Session Tracking & Attendance (HIGH PRIORITY)

**Current State:** Sessions exist only as schedule entries. No tracking of what actually happened.

**Missing Features:**
- Session status tracking (scheduled → in-progress → completed/cancelled/no-show)
- Check-in/check-out timestamps
- Attendance records and history
- No-show tracking with patterns/alerts
- Cancellation tracking (who cancelled, when, reason)
- Late arrival tracking

**Commercial Impact:** Healthcare/therapy billing requires proof of service. Insurance requires session documentation. No way to track productivity or missed appointments.

---

### 2. Billing & Insurance Integration (HIGH PRIORITY)

**Current State:** Zero billing functionality.

**Missing Features:**
- CPT/billing codes per session type
- Insurance provider management
- Insurance verification
- Claim generation/submission
- Payment tracking
- Invoicing for private pay
- Financial reporting
- Integration with clearinghouses (e.g., Availity, Office Ally)

**Commercial Impact:** Therapy practices cannot operate without billing. This is a table-stakes feature for the industry.

---

### 3. Reporting & Analytics (MEDIUM-HIGH PRIORITY)

**Current State:** Basic stats on dashboard (total sessions, staff, patients). No real analytics.

**Missing Features:**
- Staff utilization reports (hours worked vs. available)
- Patient attendance/compliance reports
- Session frequency compliance (are patients getting their required sessions?)
- Revenue reports (when billing exists)
- Cancellation/no-show rate analysis
- Therapist productivity metrics
- Schedule coverage analysis
- Trend analysis over time
- Exportable reports (Excel, CSV)

**Commercial Impact:** Practice managers need visibility into operations. No way to identify underutilized staff or patients not receiving adequate care.

---

### 4. Appointment Reminders (MEDIUM-HIGH PRIORITY)

**Current State:** Email sent when schedule is published. No appointment-level reminders.

**Missing Features:**
- SMS reminders (day before, hour before)
- Email appointment reminders
- Reminder preferences per patient/caregiver
- Customizable reminder templates
- Confirmation requests with easy response
- Calendar invitation attachments (.ics)

**Commercial Impact:** No-shows are a major revenue loss. Industry-standard is 2-3 reminders per appointment. The system notes this as "automated email/SMS notifications" in future enhancements.

---

### 5. Patient/Caregiver Portal (MEDIUM PRIORITY)

**Current State:** No patient-facing functionality.

**Missing Features:**
- Patient/caregiver login
- View upcoming appointments
- Request cancellations/reschedules
- View session history
- Update contact information
- Accept/decline appointment offers
- Secure messaging with therapist

**Commercial Impact:** Modern practice management includes patient engagement. Listed as "Patient portal for appointment viewing" in future enhancements but not implemented.

---

### 6. Waitlist & Capacity Management (MEDIUM PRIORITY)

**Current State:** AI generates schedule based on current constraints. No waitlist concept.

**Missing Features:**
- Patient waitlist for therapy slots
- Priority/urgency levels for waitlist
- Automatic slot filling when cancellations occur
- Capacity visualization (therapist utilization %)
- Overbooking controls
- New patient intake scheduling

**Commercial Impact:** Practices often have more demand than capacity. No way to manage waiting patients or quickly fill cancelled slots.

---

### 7. Recurring Sessions/Templates (MEDIUM PRIORITY)

**Current State:** Each week generates fresh from AI. Schedule copying exists but no true templates.

**Missing Features:**
- Save schedule as reusable template
- Recurring session patterns (e.g., "Patient X always Tuesday 2pm")
- Template application to new weeks
- Bulk schedule generation (multiple weeks)
- "Roll forward" with smart conflict handling

**Commercial Impact:** AI generation is powerful but unpredictable. Therapy often follows recurring patterns that shouldn't need regeneration each week.

---

### 8. Documentation & Clinical Notes (MEDIUM PRIORITY)

**Current State:** Session has a `notes` field. That's it.

**Missing Features:**
- Structured session notes/SOAP notes
- Treatment plan tracking
- Goal progress documentation
- Note templates by session type
- Required documentation enforcement
- Note signing/attestation
- Note history and amendments

**Commercial Impact:** Healthcare requires documentation. Insurance audits require clinical notes. Current system can't support clinical workflow.

---

### 9. Calendar Integration (LOW-MEDIUM PRIORITY)

**Current State:** No external calendar sync.

**Missing Features:**
- Google Calendar sync
- Outlook/Office 365 sync
- iCal feed
- Bidirectional sync (external changes reflected)
- Personal calendar blocking

**Commercial Impact:** Staff want their work schedule in their personal calendars. Listed in requirements as future enhancement.

---

### 10. Multi-Location Support (LOW-MEDIUM PRIORITY)

**Current State:** Rooms exist but no location concept.

**Missing Features:**
- Multiple locations per organization
- Staff assigned to locations
- Room assignment by location
- Location-based scheduling
- Travel time between locations

**Commercial Impact:** Many therapy practices operate multiple sites. Listed in requirements as future enhancement.

---

## Shortcuts & Technical Debt Identified

### 1. Session Swap Not Implemented

- Location: `backend/src/routes/schedules.ts` lines 627-630
- The `swap` action returns 501 "not yet implemented"
- Voice command parses swap intent but can't execute it

### 2. Coverage Rate Always 100%

- Location: `frontend/src/pages/SchedulePage.vue` line 106
- `coverageRate: 100` with TODO comment
- No actual calculation of whether patients are getting required sessions

### 3. Conflicts Count Always 0

- Location: `frontend/src/pages/DashboardPage.vue` line 35
- `conflicts: 0` with TODO comment
- No conflict detection for display purposes

### 4. Session Status Field Exists But Not Used

- Location: `backend/src/routes/schedules.ts` line 29
- Defines `status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show'])`
- Database schema doesn't include session status field
- No UI to update session status

### 5. Preferred Times Not Used in AI Generation

- Patient has `preferredTimes` field in the schema
- Unclear if AI scheduling respects this preference

### 6. Variable Session Duration

- System assumes 60-minute sessions
- Location: `backend/src/services/scheduler.ts` line 504: "Standard session duration is 60 minutes"
- No per-patient or per-session-type duration configuration

### 7. Time Slots Hardcoded

- Location: `frontend/src/pages/SchedulePage.vue` line 91
- `timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM']`
- No organization-configurable business hours

---

## Role-Specific Feature Analysis

### Staff Role Capabilities

| Feature | Available | Notes |
|---------|-----------|-------|
| View published schedules | Yes | My Schedule page |
| View all schedules | Yes | Can see other therapists |
| Request time off | Yes | With approval workflow |
| Update own availability | Partial | Can't edit default hours |
| View session history | No | No historical view |
| Check in/out of sessions | No | Not implemented |
| Document sessions | No | Notes only, no structure |

### Admin Role Capabilities

| Feature | Available | Notes |
|---------|-----------|-------|
| Generate schedules | Yes | AI-powered |
| Modify schedules | Yes | Voice + manual |
| Manage rules | Yes | Full CRUD + AI analysis |
| Manage staff/patients | Yes | Voice + manual |
| Approve time off | Yes | With notes |
| View reports | No | No analytics |
| Manage billing | No | Not implemented |

---

## Prioritized Recommendations

### Phase 1: Essential for MVP Commercial Launch

1. **Session Status Tracking** - Add completed/cancelled/no-show workflow
2. **Basic Reporting** - Staff utilization, patient attendance, schedule coverage
3. **Appointment Reminders** - Email at minimum, SMS preferred

### Phase 2: Needed for Most Practices

4. **Basic Billing Codes** - CPT codes on sessions, invoice generation
5. **Recurring Session Patterns** - Lock patient-therapist-time combinations
6. **Calendar Integration** - iCal export at minimum

### Phase 3: Competitive Differentiation

7. **Patient Portal** - View appointments, request changes
8. **Waitlist Management** - Queue patients for slots
9. **Clinical Documentation** - Structured notes, treatment plans

### Phase 4: Scale & Enterprise

10. **Full Billing/Insurance** - Claim submission, payment tracking
11. **Multi-Location** - Site-based scheduling
12. **Advanced Analytics** - Trend analysis, financial reporting

---

## Summary

The application has a **solid foundation** with impressive voice-powered scheduling and rule management. The core scheduling algorithm, multi-tenancy, security, and basic workflow are production-ready.

However, for **commercial viability in therapy/healthcare**, the critical gaps are:

- **Session outcome tracking** (completed vs. no-show)
- **Reporting** (can't measure what's not tracked)
- **Appointment reminders** (industry expectation)
- **Billing integration** (practices can't operate without it)

The system is currently more of a "schedule generator" than a complete "practice management" solution. The voice features are a strong differentiator, but practices need the operational features to run their business.

---

## Related Documents

- [Requirements Document](requirements.md) - Original project requirements
- [Availability Gap Analysis](availability-gap-analysis.md) - Previous analysis of availability features
- [Hybrid PMS Project Plan](hybrid-pms-project-plan.md) - Implementation plan addressing these gaps

---

## Status Update (December 31, 2024)

A strategic decision has been made to pursue a **Hybrid Practice Management** approach:
- Build best-in-class scheduling with selective high-value features
- Integrate with existing PMS/EHR systems for complex domains (billing, clinical documentation)
- See [Hybrid PMS Project Plan](hybrid-pms-project-plan.md) for implementation details

### Gaps Being Addressed in Phase 1

| Gap | Status | Target |
|-----|--------|--------|
| Session Status Tracking | Planned | Q1 2025 |
| Appointment Reminders | Planned | Q1 2025 |
| Basic Reporting & Analytics | Planned | Q1-Q2 2025 |
| Configurable Business Hours | Planned | Q1 2025 |
| Session Duration Flexibility | Planned | Q1 2025 |
| Coverage Rate Calculation | Planned | Q1 2025 |
| Conflict Detection Enhancement | Planned | Q1 2025 |
| Swap Session Implementation | Planned | Q1 2025 |

### Gaps Deferred to Integration Strategy (Phase 2+)

| Gap | Strategy |
|-----|----------|
| Billing & Insurance | Integrate with existing PMS |
| Clinical Documentation | Integrate with existing EHR |
| Patient Portal | Phase 3 evaluation |

---

*Document prepared as part of commercial readiness assessment.*
