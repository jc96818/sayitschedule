---
id: help.settings.custom-labels
slug: /help/settings/custom-labels
title: Custom labels
category: settings
summary: Rename Staff/Patients/Rooms (and related terms) to match your practice's terminology.
audienceRoles: [admin, admin_assistant]
tags: [settings, labels, terminology, customization]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [terminology, rename patients, rename clients, clinicians, therapists, custom terminology]
---

## When to use this

- You want the app to use your practice's terminology (for example, "Therapists" instead of "Staff" or "Clients" instead of "Patients").
- You need navigation, forms, and buttons to reflect the language your team uses daily.
- You want voice commands to recognize your custom terminology.

## How it works

Custom labels let you rename the core entities in the app—{{labels.staff.plural}}, {{labels.patient.plural}}, and {{labels.room.plural}}—along with related terms like {{labels.certification.plural}} and {{labels.equipment.plural}}. Once saved, your labels appear throughout the app:

- **Navigation sidebar**: Menu items update to show your labels.
- **Page titles and headings**: List pages and profile pages use your terminology.
- **Buttons and forms**: "Add Staff Member" becomes "Add Therapist" (or whatever you choose).
- **Voice commands**: The voice parser recognizes your custom terms when you speak commands.
- **Help content**: This help system renders using your organization's labels.

Each label has both a **plural** form (used for navigation and list headings) and a **singular** form (used for buttons, forms, and individual items).

## Steps

1. Open **Settings** from the sidebar.
2. Scroll down to the **Custom Labels** section.
3. Update the labels for each entity type:
   - **Staff Labels**: Set the plural form (e.g., "Therapists") and singular form (e.g., "Therapist").
   - **Patient Labels**: Set the plural form (e.g., "Clients") and singular form (e.g., "Client").
   - **Room Labels**: Set the plural form (e.g., "Treatment Areas") and singular form (e.g., "Treatment Area").
   - **Other Labels**: Set the labels for {{labels.certification.plural}} and {{labels.equipment.plural}}.
4. Click **Save Label Settings**.

The app immediately updates to use your new terminology.

## Label fields

| Field | Default | Used for |
|-------|---------|----------|
| Staff (plural) | Staff | Navigation, list page titles |
| Staff (singular) | Staff Member | Buttons ("Add Staff Member"), forms, profile pages |
| Patient (plural) | Patients | Navigation, list page titles |
| Patient (singular) | Patient | Buttons ("Add Patient"), forms, profile pages |
| Room (plural) | Rooms | Navigation, list page titles |
| Room (singular) | Room | Buttons ("Add Room"), forms, profile pages |
| Certifications | Certifications | Staff profile fields, matching rules |
| Equipment | Equipment | Room capabilities |

## How this changes with your settings

<!-- help:when features.voiceCommandsEnabled -->
### Voice commands

When voice commands are enabled, the voice parser automatically recognizes your custom labels. For example, if you rename "Staff" to "Therapists," you can say:

- "Add a therapist named Dr. Smith"
- "Show me all therapists"

Using your organization’s exact labels in voice/typed commands tends to produce the most reliable results.
<!-- help:end -->

## Related

- [/help/getting-started/glossary](/help/getting-started/glossary)
- [/help/settings/suggested-certifications](/help/settings/suggested-certifications)
- [/help/settings/suggested-equipment](/help/settings/suggested-equipment)
- [/help/voice/overview](/help/voice/overview)

## Troubleshooting

- **Labels not updating in the sidebar**: Try refreshing the page after saving. The sidebar reads labels from the current session, which updates on page load.
- **Voice commands not recognizing new terms**: Ensure you've saved the label settings. Voice parsing uses the stored labels from your organization settings.
- **Labels limited to 50 characters**: Each label field has a maximum length of 50 characters. Use concise terminology.
