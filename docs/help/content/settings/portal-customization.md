---
id: help.settings.portal-customization
slug: /help/settings/portal-customization
title: Portal customization fields
category: settings
summary: Customize portal text, branding, contact info, and policy links.
audienceRoles: [admin, admin_assistant]
tags: [settings, portal, branding, customization]
prerequisites:
  features: [patientPortalEnabled]
  settings: []
  org: []
aliases: [portal branding, portal theme, portal appearance]
---

## When to use this

- You want the patient portal to match your organization's brand.
- You need to add a custom welcome message for {{labels.patient.plural}}.
- You want to provide contact information and legal links in the portal.

## How it works

Portal customization lets you personalize the appearance and content of the patient portal. These settings only affect the portal—they don't change the main application.

You can customize:

- **Appearance**: Colors, logo, and background image.
- **Welcome content**: Title and message shown on the portal home page.
- **Contact information**: Support email and phone number.
- **Footer**: Custom footer text and links to terms/privacy policies.

## Steps

### Customize portal appearance

1. Open **Settings** from the sidebar.
2. Find the **Patient Portal & Self-Booking** section.
3. Scroll to **Portal Appearance**.
4. Configure the appearance options:
   - **Show Organization Name**: Display your organization name in the portal header.
   - **Portal Primary Color**: Main accent color (leave blank to use organization branding).
   - **Portal Secondary Color**: Secondary accent color (leave blank to use organization branding).
   - **Portal Logo URL**: Custom logo for the portal (leave blank to use organization logo).
   - **Portal Background Image URL**: Background image for the portal sign-in page.
5. Click **Save Portal Settings**.

### Add welcome content

1. In the **Portal Appearance** section:
   - **Welcome Title**: Short heading shown on the portal home page (max 100 characters).
   - **Welcome Message**: Longer welcome text (max 500 characters).
2. Click **Save Portal Settings**.

### Configure contact and footer

1. Scroll to **Portal Footer & Legal**.
2. Configure:
   - **Support Email**: Email address for {{labels.patient.singular}} support inquiries.
   - **Support Phone**: Phone number for support.
   - **Footer Text**: Custom text shown at the bottom of portal pages.
   - **Terms URL**: Link to your terms of service.
   - **Privacy URL**: Link to your privacy policy.
3. Click **Save Portal Settings**.

## Customization options

| Field | Purpose | Notes |
| ----- | ------- | ----- |
| Portal Primary Color | Buttons, links, accents | Hex format (e.g., #2563eb) |
| Portal Secondary Color | Hover states, secondary elements | Hex format |
| Portal Logo URL | Custom portal logo | Publicly accessible URL |
| Portal Background URL | Sign-in page background | Publicly accessible URL |
| Welcome Title | Portal home page heading | Max 100 characters |
| Welcome Message | Portal home page text | Max 500 characters |
| Support Email | Contact email | Shown in portal footer |
| Support Phone | Contact phone | Shown in portal footer |
| Footer Text | Custom footer message | Max 500 characters |
| Terms URL | Terms of service link | Full URL |
| Privacy URL | Privacy policy link | Full URL |

## How this changes with your settings

- **Organization branding**: If you leave portal colors blank, the portal uses your organization's primary and secondary colors from the main branding settings.
- **Logo fallback**: If no portal logo is set, the portal uses your organization's main logo.

## Related

- `/help/settings/patient-portal`
- `/help/settings/branding`
- `/help/portal/sign-in`

## Troubleshooting

- **Colors not appearing**: Ensure you're using valid hex color codes starting with `#` (e.g., `#2563eb`).
- **Logo or background not showing**: Verify the URLs are publicly accessible. Try opening them directly in a browser.
- **Welcome message too long**: The welcome title is limited to 100 characters and the message to 500 characters.
- **Links not working in footer**: Ensure you're using complete URLs including `https://`.
