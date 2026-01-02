---
id: help.portal.appointments
slug: /help/portal/appointments
title: View appointments in portal
category: portal
summary: How portal users view their upcoming and past appointments.
audienceRoles: [admin, admin_assistant, staff]
tags: [portal, appointments, view, confirm, cancel]
prerequisites:
  features: [patientPortalEnabled]
  settings: []
  org: []
aliases: [portal appointments, portal schedule, my appointments]
---

## When to use this

- A {{labels.patient.singular}} wants to know how to view their appointments in the portal.
- You need to explain the appointment confirmation or cancellation process.
- A {{labels.patient.singular}} is asking about an appointment status.

## How it works

The portal appointments page shows {{labels.patient.plural}} their scheduled sessions. The page has two tabs:

- **Upcoming**: Future appointments that are scheduled, pending, or confirmed.
- **Past**: Previous appointments with their final status (completed, cancelled, no-show, etc.).

Depending on your portal settings, {{labels.patient.plural}} may be able to:

- **Confirm** appointments (if confirmation is required)
- **Cancel** appointments (if cancellation is allowed)
- **Reschedule** appointments (if rescheduling is allowed)

## Steps

### View upcoming appointments

1. Sign in to the patient portal.
2. The **Upcoming** tab is selected by default.
3. View the list of scheduled appointments with:
   - Date and time
   - {{labels.staff.singular}} name
   - {{labels.room.singular}} (if assigned)
   - Status badge (Scheduled, Confirmed, Pending, etc.)

### View past appointments

1. Click the **Past** tab.
2. View historical appointments with their final status.
3. Use the pagination controls to navigate through older appointments.

### Confirm an appointment

If confirmation is required and the appointment shows a **Confirm** button:

1. Click **Confirm** on the appointment card.
2. The status changes from "Scheduled" to "Confirmed".
3. The confirmation is recorded in the system.

### Cancel an appointment

If cancellation is allowed and the appointment shows a **Cancel** button:

1. Click **Cancel** on the appointment card.
2. Confirm the cancellation when prompted.
3. The appointment is removed from the upcoming list.

### Reschedule an appointment

If rescheduling is allowed and the appointment shows a **Reschedule** button:

1. Click **Reschedule** on the appointment card.
2. The portal opens the booking page with available times.
3. Select a new time slot.
4. The original appointment is cancelled and a new one is created.

## Appointment statuses

| Status | Meaning |
| ------ | ------- |
| Pending Approval | Self-booked appointment waiting for staff approval |
| Scheduled | Appointment is confirmed in the schedule |
| Confirmed | {{labels.patient.singular}} has confirmed attendance |
| Completed | Session was completed |
| Cancelled | Appointment was cancelled |
| Late Cancellation | Cancelled within the late-cancel window |
| No Show | {{labels.patient.singular}} did not attend |

## How this changes with your settings

- **Require Appointment Confirmation**: If enabled, appointments show a "Confirm" button until the {{labels.patient.singular}} confirms.
- **Allow Portal Cancellation**: If enabled, a "Cancel" button appears on upcoming appointments.
- **Allow Portal Rescheduling**: If enabled, a "Reschedule" button appears on upcoming appointments.
- **Custom labels**: The {{labels.staff.singular}} and {{labels.room.singular}} labels use your organization's terminology.

## Related

- [/help/portal/sign-in](/help/portal/sign-in)
- [/help/portal/booking](/help/portal/booking)
- [/help/settings/patient-portal](/help/settings/patient-portal)

## Troubleshooting

- **No appointments showing**: The {{labels.patient.singular}} may not have any scheduled sessions. Check the schedule in the main app.
- **Can't find Confirm/Cancel/Reschedule button**: These buttons only appear if the corresponding feature is enabled in portal settings.
- **Appointment status not updating**: Try refreshing the page. If the issue persists, check the schedule in the main app.
- **Past appointments not loading**: Check your internet connection and try clicking **Try Again**.
