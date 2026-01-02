---
id: help.settings.branding
slug: /help/settings/branding
title: Organization branding
category: settings
summary: Update organization name, colors, and logo.
audienceRoles: [admin, admin_assistant]
tags: [settings, branding, colors, logo]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [colors, logo, theme, customize]
---

## When to use this

- You want to customize the app's appearance to match your organization's brand.
- You need to update your organization's name.
- You want to add or change your organization's logo.

## How it works

Organization branding settings let you personalize the app's appearance. Changes apply immediately and affect all users in your organization.

You can customize:

- **Organization Name**: Displayed in the app header and on printed schedules.
- **Primary Color**: Used for buttons, links, and accent elements.
- **Secondary Color**: Used for hover states and secondary UI elements.
- **Logo**: Displayed in the app header and on printed schedules.

Colors are previewed in real-time as you adjust them, so you can see how they look before saving.

When you upload a logo, the system automatically:

- Resizes it to multiple sizes for optimal display in different contexts (sidebar, headers, etc.)
- Creates a grayscale version for use on printed schedules and reports

## Steps

### Update organization branding

1. Open **Settings** from the sidebar.
2. Find the **Organization Branding** card.
3. Update the **Organization Name** if needed.
4. Set your **Primary Color**:
   - Click the color picker to choose a color visually, or
   - Enter a hex code directly (e.g., `#2563eb`).
5. Set your **Secondary Color** using the same method.
6. Click **Save Changes**.

### Upload a logo

1. In the **Organization Branding** card, find the **Organization Logo** section.
2. Click the upload area or drag and drop an image file.
3. Supported formats: PNG, JPG, WebP, GIF, or SVG (max 5MB).
4. The logo uploads immediately and a preview appears.
5. The system automatically creates multiple sizes and a grayscale version for print.

### Change or remove a logo

1. If a logo is already uploaded, you'll see the current logo with **Change** and **Remove** buttons.
2. Click **Change** to upload a new logo (replaces the existing one).
3. Click **Remove** to delete the logo entirely.

### Reset to original values

1. If you want to discard your changes, click **Reset**.
2. This restores the values to what they were when you opened the page.

## What each setting affects

| Setting | Where it appears |
| ------- | ---------------- |
| Organization Name | App header, printed schedules, patient portal (if enabled) |
| Primary Color | Buttons, links, active states, accent elements |
| Secondary Color | Hover effects, secondary buttons, subtle accents |
| Logo | App header (sidebar), printed schedules (grayscale version) |

## How this changes with your settings

- **Patient Portal**: If the patient portal is enabled and you haven't set separate portal colors, the portal will use your organization branding colors.
- **Printed schedules**: The organization name and logo (grayscale) appear in the printed schedule header.

## Related

- [/help/settings/custom-labels](/help/settings/custom-labels)
- [/help/settings/portal-customization](/help/settings/portal-customization)

## Troubleshooting

- **Logo upload fails**: Ensure your file is one of the supported formats (PNG, JPG, WebP, GIF, SVG) and under 5MB in size.
- **Logo looks blurry**: For best results, upload an image at least 256x256 pixels. The system will resize it appropriately.
- **Colors look different than expected**: Make sure you're entering valid hex codes starting with `#` (e.g., `#2563eb`). The color picker shows a preview—use it to verify your selection.
- **Changes not saving**: Ensure you click **Save Changes** after making edits. Check for any error messages that appear.
- **Reset button not working**: The reset button restores values to what they were when you opened the page, not the original defaults.
- **Logo not appearing on printed schedules**: The grayscale logo appears on PDF exports. If you just uploaded a logo, try downloading the PDF again.
