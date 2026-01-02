---
id: help.settings.self-booking
slug: /help/settings/self-booking
title: Self-booking controls
category: settings
summary: Configure whether patients/caregivers can request or book appointments through the portal.
audienceRoles: [admin, admin_assistant]
tags: [settings, portal, booking, self-service]
prerequisites:
  features: [selfBookingEnabled]
  settings: []
  org: []
aliases: [self booking, booking rules, approval, appointment requests]
---

## When to use this

- You want {{labels.patient.plural}} to be able to book their own appointments.
- You need to control how far in advance {{labels.patient.plural}} can book.
- You want to require staff approval before self-booked appointments are confirmed.

## How it works

<!-- help:when features.selfBookingEnabled -->
Self-booking allows {{labels.patient.plural}} to request or book appointments directly through the patient portal. You control:

- **Lead time**: How soon before an appointment slot a {{labels.patient.singular}} can book (prevents last-minute bookings).
- **Future booking limit**: How far into the future {{labels.patient.plural}} can book.
- **Approval requirement**: Whether bookings are automatically confirmed or require staff approval.

When a {{labels.patient.singular}} books through the portal, the system checks {{labels.staff.singular}} availability and creates either a confirmed appointment or a pending request, depending on your settings.
<!-- help:end -->

<!-- help:when-not features.selfBookingEnabled -->
Self-booking isn't enabled for your organization. Enable it in Settings to allow {{labels.patient.plural}} to book appointments through the portal.
<!-- help:end -->

## Steps

### Enable self-booking

1. Open **Settings** from the sidebar.
2. Find the **Patient Portal & Self-Booking** section.
3. Check **Enable Self-Booking**.
4. Configure the self-booking controls:
   - **Lead Time (hours)**: Minimum hours before an appointment that a {{labels.patient.singular}} can book. For example, 24 means they can't book anything less than 24 hours away.
   - **Max Future Days**: Maximum days into the future a {{labels.patient.singular}} can book. For example, 30 limits bookings to the next 30 days.
   - **Require Approval**: If checked, self-booked appointments are created as "pending" and require staff approval.
5. Click **Save Portal Settings**.

### Configure booking restrictions

| Setting | Purpose | Recommended value |
| ------- | ------- | ----------------- |
| Lead Time | Prevents last-minute bookings that may disrupt scheduling | 24-48 hours |
| Max Future Days | Limits how far ahead {{labels.patient.plural}} can book | 30-60 days |
| Require Approval | Gives staff control over self-booked appointments | Enable for busy practices |

### Disable self-booking

1. Open **Settings** from the sidebar.
2. Find the **Patient Portal & Self-Booking** section.
3. Uncheck **Enable Self-Booking**.
4. Click **Save Portal Settings**.

{{labels.patient.plural}} will still be able to view appointments if the patient portal is enabled, but the booking option will not appear.

## How approval works

When **Require Approval** is enabled:

1. {{labels.patient.singular}} selects an available time slot in the portal.
2. The system creates a **pending** appointment request.
3. Staff see the pending request and can approve or decline it.
4. Once approved, the appointment is confirmed and appears on the schedule.

When **Require Approval** is disabled:

1. {{labels.patient.singular}} selects an available time slot in the portal.
2. The system creates a **confirmed** appointment immediately.
3. The appointment appears on the schedule right away.

## How this changes with your settings

- **Patient portal required**: Self-booking only works when the patient portal is also enabled.
- **{{labels.staff.singular}} availability**: {{labels.patient.plural}} can only book times when a {{labels.staff.singular}} is available based on their working hours.
- **{{labels.certification.plural}} matching**: If a {{labels.patient.singular}} requires specific {{labels.certification.plural}}, only {{labels.staff.plural}} with those {{labels.certification.plural}} will show available slots.

## Related

- `/help/settings/patient-portal`
- `/help/portal/booking`
- `/help/people/staff-profile`

## Troubleshooting

- **No available time slots showing**: Check that {{labels.staff.plural}} have working hours configured and are marked as active.
- **{{labels.patient.singular}} can't book specific times**: The lead time setting may be preventing bookings too close to the current time.
- **Bookings not appearing on schedule**: If approval is required, check for pending appointment requests that need approval.
- **Self-booking option not visible in portal**: Ensure both "Enable Patient Portal" and "Enable Self-Booking" are checked.
