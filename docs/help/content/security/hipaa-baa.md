---
id: help.security.hipaa-baa
slug: /help/security/hipaa-baa
title: HIPAA/BAA basics in the app
category: security
summary: How HIPAA-related settings and BAA workflows relate to the application.
audienceRoles: [admin, admin_assistant]
tags: [security, hipaa, baa, compliance, phi]
prerequisites:
  features: []
  settings: []
  org: [requiresHipaa]
aliases: [hipaa, baa, business associate agreement, phi, protected health information]
---

## When to use this

- Your organization handles Protected Health Information (PHI).
- You need to sign a Business Associate Agreement (BAA) with Say It Schedule.
- You want to understand HIPAA-related features in the app.
- You're checking the status of your BAA.

## How it works

<!-- help:when org.requiresHipaa -->
Your organization is configured to require HIPAA compliance controls. This means:

- A signed Business Associate Agreement (BAA) is required before using PHI-related features.
- Certain security features like MFA may be mandatory.
- Voice transcription uses HIPAA-eligible AWS Medical Transcribe.
- Additional audit logging may be enabled.
<!-- help:end -->

<!-- help:when-not org.requiresHipaa -->
HIPAA controls aren't currently enabled for your organization. If your organization handles Protected Health Information (PHI), contact your administrator or Say It Schedule support to enable HIPAA compliance mode.
<!-- help:end -->

## What is a BAA?

A Business Associate Agreement (BAA) is a legally binding contract required under HIPAA. It's an agreement between:

- **Covered Entity**: Your organization (healthcare provider, health plan, or healthcare clearinghouse)
- **Business Associate**: Say It Schedule (a vendor that handles PHI on your behalf)

The BAA ensures that Say It Schedule will:

- Appropriately safeguard any PHI created, received, maintained, or transmitted
- Report any security incidents or breaches
- Comply with HIPAA Privacy and Security Rules
- Only use PHI for permitted purposes

## Steps

### View BAA status

1. Open **HIPAA BAA** from the sidebar.
2. View the current agreement status:
   - **Not Started**: No BAA has been initiated
   - **Awaiting Organization Signature**: Ready for you to sign
   - **Awaiting Vendor Signature**: You've signed; waiting for Say It Schedule to countersign
   - **Executed**: Fully signed and in effect
   - **Voided**: Agreement has been cancelled

### Sign the BAA

Only administrators can sign the BAA on behalf of the organization.

1. Open **HIPAA BAA** from the sidebar.
2. Click **Preview Agreement** to review the full text.
3. Click **Review & Sign BAA**.
4. Enter your information:
   - **Full Legal Name**: Your name as it should appear on the agreement
   - **Title / Position**: Your role (e.g., Administrator, Owner, Director)
   - **Email Address**: Your contact email
5. Check the consent box to confirm you have authority to sign.
6. Click **Sign Agreement**.

After you sign, Say It Schedule will review and countersign the agreement. You'll be notified when it's fully executed.

### Download the executed BAA

Once the BAA is fully executed:

1. Open **HIPAA BAA** from the sidebar.
2. Click **Download Executed BAA**.
3. Save the PDF for your records.

Keep a copy of the executed BAA with your compliance documentation.

## BAA statuses explained

| Status | Meaning |
| ------ | ------- |
| Not Started | No BAA has been initiated. Click "Review & Sign BAA" to begin. |
| Awaiting Organization Signature | The BAA is ready for your organization to sign. |
| Awaiting Vendor Signature | You've signed. Say It Schedule is reviewing and will countersign. |
| Executed | The BAA is fully signed and in effect. PHI workflows are enabled. |
| Voided | The agreement has been cancelled. Contact support if you need a new BAA. |

## HIPAA features in Say It Schedule

When HIPAA compliance is enabled, the following features are available or enforced:

### Security controls

- **Multi-factor authentication (MFA)**: May be required for all users
- **Session timeouts**: Automatic logout after inactivity
- **Audit logging**: Enhanced logging of access and changes

### Voice transcription

- **AWS Medical Transcribe**: HIPAA-eligible transcription service
- **Medical specialty support**: Improved recognition of clinical terminology
- **Secure processing**: Audio is processed in compliance with HIPAA requirements

### Data handling

- **Encryption**: All data encrypted at rest and in transit
- **Access controls**: Role-based permissions for PHI access
- **Secure backups**: Regular encrypted backups

## How this changes with your settings

- **HIPAA mode enabled**: BAA is required before certain features work. MFA may be mandatory.
- **AWS Medical Transcribe**: Voice commands use HIPAA-eligible transcription when configured.
- **Patient portal**: Portal access and self-booking are available after BAA execution.

## Related

- [/help/security/mfa](/help/security/mfa)
- [/help/settings/patient-portal](/help/settings/patient-portal)
- [/help/voice/transcription-settings](/help/voice/transcription-settings)

## Troubleshooting

- **Can't access BAA page**: Only administrators can view and sign the BAA. Contact your administrator.
- **"BAA required" message**: Your organization needs a signed BAA before using PHI features. Open **HIPAA BAA** from the sidebar to sign.
- **BAA stuck on "Awaiting Vendor Signature"**: Say It Schedule typically countersigns within 1-2 business days. Contact support if it takes longer.
- **Need to update signer information**: If the wrong person signed, contact Say It Schedule support to void and re-issue the BAA.
- **Organization not marked as HIPAA**: Contact Say It Schedule support to enable HIPAA compliance mode for your organization.
