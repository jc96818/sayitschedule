---
id: help.settings.patient-portal
slug: /help/settings/patient-portal
title: Patient portal overview
category: settings
summary: Enable and configure the patient/caregiver portal.
audienceRoles: [admin, admin_assistant]
tags: [settings, portal, patients]
prerequisites:
  features: [patientPortalEnabled]
  settings: []
  org: []
aliases: [caregiver portal, portal, patient access]
---

## When to use this

- You want to give {{labels.patient.plural}} or their caregivers access to view their appointments.
- You need to allow {{labels.patient.plural}} to confirm, cancel, or reschedule appointments online.
- You want to reduce phone calls by providing self-service appointment management.

## How it works

<!-- help:when features.patientPortalEnabled -->
The patient portal is a separate website where {{labels.patient.plural}} and caregivers can:

- **View appointments**: See upcoming and past scheduled sessions.
- **Confirm appointments**: Mark appointments as confirmed (if required by your settings).
- **Cancel appointments**: Cancel upcoming appointments (if allowed by your settings).
- **Reschedule appointments**: Request to move appointments to a different time (if allowed by your settings).

Each {{labels.patient.singular}} receives a unique portal link or can sign in using their email and a verification code. The portal is separate from the main application and doesn't require a user account.
<!-- help:end -->

<!-- help:when-not features.patientPortalEnabled -->
The patient portal isn't enabled for your organization. Enable it in Settings to make portal pages available to your {{labels.patient.plural}}.
<!-- help:end -->

## Steps

### Enable the patient portal

1. Open **Settings** from the sidebar.
2. Find the **Patient Portal & Self-Booking** section.
3. Check **Enable Patient Portal**.
4. Configure the portal options:
   - **Require Appointment Confirmation**: {{labels.patient.plural}} must confirm appointments in the portal.
   - **Allow Portal Cancellation**: {{labels.patient.plural}} can cancel their own appointments.
   - **Allow Portal Rescheduling**: {{labels.patient.plural}} can request to reschedule appointments.
5. Click **Save Portal Settings**.

### Disable the patient portal

1. Open **Settings** from the sidebar.
2. Find the **Patient Portal & Self-Booking** section.
3. Uncheck **Enable Patient Portal**.
4. Click **Save Portal Settings**.

When disabled, portal links will no longer work and {{labels.patient.plural}} cannot access the portal.

## Portal access options

| Option | What it controls |
| ------ | ---------------- |
| Require Appointment Confirmation | {{labels.patient.plural}} see a "Confirm" button and must actively confirm each appointment |
| Allow Portal Cancellation | {{labels.patient.plural}} can cancel appointments directly from the portal |
| Allow Portal Rescheduling | {{labels.patient.plural}} can request to move appointments to a different time |

## How this changes with your settings

- **Self-booking**: If you also enable self-booking, {{labels.patient.plural}} can book new appointments through the portal.
- **Portal customization**: You can customize the portal's appearance, welcome message, and contact information.

## Related

- `/help/settings/self-booking`
- `/help/settings/portal-customization`
- `/help/portal/sign-in`
- `/help/portal/appointments`

## Troubleshooting

- **{{labels.patient.plural}} can't access the portal**: Ensure the patient portal is enabled in settings.
- **Portal link not working**: Verify the {{labels.patient.singular}} has a valid email address on file. Portal links may expire after a period of time.
- **Confirmation button not showing**: Check that "Require Appointment Confirmation" is enabled in portal settings.
