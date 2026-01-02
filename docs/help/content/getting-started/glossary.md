---
id: help.getting-started.glossary
slug: /help/getting-started/glossary
title: Glossary (labels + terms)
category: getting-started
summary: Definitions of key terms used throughout the app, including your organization's custom labels.
audienceRoles: [admin, admin_assistant, staff]
tags: [glossary, terminology, labels, definitions]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [terminology, definitions, terms, vocabulary]
---

## When to use this

- You encounter a term in the app and want to understand what it means.
- You're new to Say It Schedule and want to learn the core concepts.
- You want to understand how your organization's custom labels map to the underlying system.

## How it works

Say It Schedule uses consistent underlying concepts throughout the app. Your organization may customize the labels shown in the UI (for example, calling {{labels.staff.plural}} “Therapists”), but the underlying entities remain the same.

## Steps

1. Use this glossary when you see a term you don’t recognize.
2. If the UI wording doesn’t match your team’s terminology, check **Settings → Custom Labels** (admins) and then re-read the relevant definitions here.
3. Follow the **Related** links for step-by-step guides.

## Core entities

These are the main objects you work with in Say It Schedule:

### {{labels.staff.singular}} / {{labels.staff.plural}}

The people who provide sessions. Each {{labels.staff.singular}} has:
- **Name and contact info**: For identification and communication.
- **Gender**: Used for gender-pairing rules.
- **{{labels.certification.plural}}**: Skills or qualifications (e.g., "Pediatric Certified").
- **Default hours**: The typical weekly availability.
- **Status**: Active or inactive.

### {{labels.patient.singular}} / {{labels.patient.plural}}

The people who receive sessions. Each {{labels.patient.singular}} has:
- **Name and identifier**: For identification (identifier is optional, e.g., a medical record number).
- **Gender**: Used for gender-pairing rules.
- **Session frequency**: How many sessions per week are needed.
- **Required {{labels.certification.plural}}**: What qualifications their {{labels.staff.singular}} must have.
- **Preferred times**: When they prefer to be scheduled.
- **Required room capabilities**: What {{labels.equipment.plural}} they need in their {{labels.room.singular}}.
- **Status**: Active or inactive.

### {{labels.room.singular}} / {{labels.room.plural}}

The physical spaces where sessions occur. Each {{labels.room.singular}} has:
- **Name**: For identification.
- **Capabilities / {{labels.equipment.plural}}**: What equipment or features the room has (e.g., "Wheelchair Accessible", "Therapy Swing").
- **Status**: Active or inactive.

### Schedule

A collection of sessions for a specific week. Schedules have two statuses:
- **Draft**: Not yet published.
- **Published**: Published and generally considered final.

### Session

A single appointment within a schedule. Each session has:
- **Date and time**: When the session occurs.
- **{{labels.staff.singular}}**: Who is providing the session.
- **{{labels.patient.singular}}**: Who is receiving the session.
- **{{labels.room.singular}}**: Where it takes place (optional).
- **Status**: The current state of the appointment (see Session statuses below).

### Rule

A constraint or preference that guides schedule generation. Rules have:
- **Category**: The type of rule (see Rule categories below).
- **Description**: What the rule does in plain language.
- **Priority**: How important the rule is (higher = more important).
- **Status**: Active or inactive.

## Session statuses

Sessions move through a lifecycle:

| Status | Meaning |
| ------ | ------- |
| Pending | Awaiting approval (for self-booked appointments when approval is required) |
| Scheduled | Booked on the calendar |
| Confirmed | {{labels.patient.singular}} or caregiver has confirmed attendance (when confirmation is used) |
| Checked In | {{labels.patient.singular}} has arrived |
| In Progress | Session is currently happening |
| Completed | Session finished successfully |
| Cancelled | Session was cancelled with adequate notice |
| Late Cancel | Session was cancelled within the late cancellation window |
| No Show | {{labels.patient.singular}} did not attend |

## Rule categories

Rules are organized into categories:

| Category | Purpose |
| -------- | ------- |
| Gender Pairing | Match {{labels.patient.plural}} with {{labels.staff.plural}} based on gender preferences |
| Session | Control session timing, duration, and frequency |
| Availability | Respect {{labels.staff.singular}} availability and time-off |
| Specific Pairing | Assign specific {{labels.patient.plural}} to specific {{labels.staff.plural}} |
| Certification | Match {{labels.patient.plural}} with {{labels.staff.plural}} who have required {{labels.certification.plural}} |

## User roles

The app has four user roles with different permissions:

| Role | Can do |
| ---- | ------ |
| Super Admin | Manage all organizations, create new orgs, access any org context |
| Admin | Full access within their organization: manage {{labels.staff.plural}}, {{labels.patient.plural}}, {{labels.room.plural}}, rules, schedules, and settings |
| Admin Assistant | Day-to-day scheduling and management (people, rules, schedules) |
| Staff | View schedules and manage their own availability/time off |

## Availability and time-off

### Default hours
The recurring weekly schedule for a {{labels.staff.singular}}—the days and times they normally work.

### Staff availability
Exceptions to default hours for specific dates. Used for:
- **Time-off requests**: Days when a {{labels.staff.singular}} is unavailable.
- **Modified hours**: Days with different start/end times than usual.

### Availability status
Time-off requests go through an approval workflow:
- **Pending**: Awaiting admin review.
- **Approved**: Request granted.
- **Rejected**: Request denied.

## How this changes with your settings

Some terms apply only when specific features are enabled for your organization.

<!-- help:when features.patientPortalEnabled -->

### Patient portal
A separate website where {{labels.patient.plural}} or their caregivers can:
- View upcoming appointments.
- Confirm attendance.
- Cancel or reschedule (if enabled).
- Book new appointments (if self-booking is enabled).

### Contact
A person associated with a {{labels.patient.singular}} who can access the portal. This can be the {{labels.patient.singular}} themselves (for adults) or a parent, guardian, or caregiver.

### Self-booking
A feature that allows portal users to book their own appointments within configured limits (lead time, how far in advance, etc.).

### Appointment hold
When a portal user selects a time slot for booking, the system temporarily holds that slot for a few minutes while they complete the booking. This prevents double-booking.

<!-- help:end -->

## Settings terms

### Business hours
The days and times your organization is open for appointments. This is used when offering or validating appointment times.

### Slot interval
The time increment used for scheduling (e.g., 30 minutes means sessions can start at 8:00, 8:30, 9:00, etc.).

### Default session duration
The standard length for sessions when not otherwise specified (e.g., 60 minutes).

### Late cancel window
The number of hours before an appointment within which cancellation is considered "late" (e.g., 24 hours).

## Other terms

### Organization
A single practice or clinic using Say It Schedule. Each organization has its own data, settings, and users.

### Business type template
A pre-configured set of labels and suggested {{labels.certification.plural}}/{{labels.equipment.plural}} for different practice types (e.g., a "Physical Therapy" template might use "Therapists" and "Clients").

### Audit log
A record of who changed what and when.

### BAA (Business Associate Agreement)
A HIPAA-required contract between your organization and Say It Schedule. Required for organizations handling protected health information.

## Related

- [/help/settings/custom-labels](/help/settings/custom-labels)
- [/help/getting-started/roles](/help/getting-started/roles)
- [/help/rules/overview](/help/rules/overview)
- [/help/schedules/generate](/help/schedules/generate)

## Troubleshooting

- **The app uses different words than this glossary**: Your organization may use custom labels; see [/help/settings/custom-labels](/help/settings/custom-labels).
- **You don’t see portal-related terms in the app**: The portal may not be enabled for your organization.
- **You see “Scheduled” and “Confirmed” and aren’t sure of the difference**: “Scheduled” means booked; “Confirmed” means the appointment was explicitly confirmed (when that flow is used).
