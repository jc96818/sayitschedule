---
id: help.portal.sign-in
slug: /help/portal/sign-in
title: Portal sign-in and verification
category: portal
summary: How patients/caregivers sign in to the portal and complete verification.
audienceRoles: [admin, admin_assistant, staff]
tags: [portal, sign-in, verification, login]
prerequisites:
  features: [patientPortalEnabled]
  settings: []
  org: []
aliases: [portal login, verify, magic link, otp]
---

## When to use this

- A {{labels.patient.singular}} or caregiver is having trouble signing in to the portal.
- You need to explain the portal sign-in process to a {{labels.patient.singular}}.
- A {{labels.patient.singular}} is asking about the verification code or login link.

## How it works

The patient portal uses a passwordless sign-in system. {{labels.patient.plural}} don't need to remember a password—they verify their identity through their email or phone number.

**Two sign-in methods are available:**

1. **Email**: The portal sends a magic link. Clicking the link signs them in automatically.
2. **Phone (SMS)**: The portal sends a 6-digit verification code that must be entered manually.

## Steps

### Sign in with email

1. Go to the portal sign-in page.
2. Ensure **Email** is selected (the default).
3. Enter the email address on file for the {{labels.patient.singular}}.
4. Click **Send Login Link**.
5. Check the email inbox for a message from the portal.
6. Click the login link in the email.
7. The portal opens and signs in automatically.

### Sign in with phone

1. Go to the portal sign-in page.
2. Click **Phone** to switch to SMS verification.
3. Enter the phone number on file for the {{labels.patient.singular}}.
4. Click **Send Login Code**.
5. Check for a text message with a 6-digit code.
6. Enter the code on the verification page.
7. Click **Verify & Sign In**.

### Resend a verification code

If the code or link didn't arrive:

1. On the verification page, click **Resend code**.
2. Wait a moment for the new code or link to arrive.
3. Use the new code (previous codes become invalid).

### Use a different email or phone

1. On the verification page, click **Use different email** (or **Use different phone**).
2. Enter the correct email or phone number.
3. Request a new code or link.

## What {{labels.patient.plural}} see

| Page | Description |
| ---- | ----------- |
| Sign-in page | Welcome message, email/phone toggle, input field |
| Verification page | Shows masked email/phone, code entry (for SMS), or auto-verifies (for email links) |
| Dashboard | Appointments and portal features after successful sign-in |

## How this changes with your settings

- **Portal customization**: The sign-in page shows your organization's logo, welcome title, welcome message, and contact information.
- **Email/phone on file**: {{labels.patient.plural}} must use the email or phone number stored in their {{labels.patient.singular}} record. If the wrong contact info is entered, sign-in will fail.

## Related

- `/help/settings/patient-portal`
- `/help/settings/portal-customization`
- `/help/portal/appointments`

## Troubleshooting

- **"Email not found" or "Phone not found"**: The entered email or phone doesn't match any {{labels.patient.singular}} record. Verify the {{labels.patient.singular}}'s contact information in the system.
- **Magic link expired**: Email login links expire after a period of time. Request a new link by going back to the sign-in page.
- **Verification code invalid**: Codes expire and can only be used once. Click **Resend code** to get a new one.
- **Not receiving emails**: Check spam/junk folders. Ensure the email address is correct in the {{labels.patient.singular}} record.
- **Not receiving text messages**: Verify the phone number is correct and can receive SMS. Some landlines cannot receive text messages.
- **Portal unavailable message**: The patient portal may not be enabled for your organization. Contact an administrator.
