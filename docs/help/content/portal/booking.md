---
id: help.portal.booking
slug: /help/portal/booking
title: Book an appointment (self-booking)
category: portal
summary: How portal users book or request appointments (when self-booking is enabled).
audienceRoles: [admin, admin_assistant, staff]
tags: [portal, booking, self-service, appointments]
prerequisites:
  features: [patientPortalEnabled, selfBookingEnabled]
  settings: []
  org: []
aliases: [self booking, portal booking, request appointment]
---

## When to use this

- A {{labels.patient.singular}} wants to book their own appointment through the portal.
- You need to explain the self-booking process and its limitations.
- A {{labels.patient.singular}} is asking why they can't book certain times.

## How it works

<!-- help:when features.selfBookingEnabled -->
When self-booking is enabled, {{labels.patient.plural}} can browse available time slots and book appointments directly through the portal. The system shows only times when:

- A {{labels.staff.singular}} is available based on their working hours
- The {{labels.staff.singular}} has the required {{labels.certification.plural}} (if the {{labels.patient.singular}} has requirements)
- The time meets your organization's lead time and future booking limits

Depending on your settings, booked appointments are either:

- **Automatically confirmed**: Appears immediately on the schedule
- **Pending approval**: Requires staff approval before confirmation
<!-- help:end -->

<!-- help:when-not features.selfBookingEnabled -->
Self-booking isn't enabled for your organization. {{labels.patient.plural}} can view their appointments but cannot book new ones through the portal.
<!-- help:end -->

## Steps

### Book a new appointment

1. Sign in to the patient portal.
2. Click **Book Appointment** (or navigate to the booking page).
3. Select a date from the calendar.
4. View available time slots for that date.
5. Click on an available time slot.
6. Review the appointment details:
   - Date and time
   - Assigned {{labels.staff.singular}} (if shown)
7. Click **Confirm Booking**.
8. The appointment is created (either confirmed or pending, based on settings).

### Reschedule an existing appointment

1. Go to **My Appointments**.
2. Find the appointment you want to reschedule.
3. Click **Reschedule**.
4. Select a new date and time slot.
5. Confirm the new time.
6. The original appointment is cancelled and replaced.

## Booking restrictions

Your organization controls what times {{labels.patient.plural}} can book:

| Restriction | What it means |
| ----------- | ------------- |
| Lead time | Minimum hours before an appointment can be booked (e.g., 24 hours means no same-day booking) |
| Max future days | How far in advance bookings are allowed (e.g., 30 days) |
| Approval required | Bookings need staff approval before confirmation |

## How this changes with your settings

- **Lead time**: {{labels.patient.plural}} cannot book appointments that start within the lead time window.
- **Max future days**: The calendar only shows available dates within this limit.
- **Approval required**: If enabled, bookings show as "Pending Approval" until staff approves them.
- **{{labels.certification.plural}} matching**: If a {{labels.patient.singular}} requires specific {{labels.certification.plural}}, only {{labels.staff.plural}} with those {{labels.certification.plural}} appear as available.

## Related

- `/help/settings/self-booking`
- `/help/portal/appointments`
- `/help/settings/patient-portal`

## Troubleshooting

- **No available time slots**: All {{labels.staff.plural}} may be booked, or the time is within the lead time restriction. Try a different date.
- **Can't book further ahead**: Your organization limits how far in advance {{labels.patient.plural}} can book. Contact the office for appointments beyond this limit.
- **Booking not appearing on schedule**: If approval is required, the booking is pending until staff approves it.
- **"Self-booking not available" message**: Self-booking may not be enabled. Contact your organization to book an appointment.
