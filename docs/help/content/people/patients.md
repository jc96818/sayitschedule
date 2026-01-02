---
id: help.people.patients
slug: /help/people/patients
title: Add and manage {{labels.patient.plural}}
category: people
summary: Create, update, and organize your {{labels.patient.plural}} for scheduling.
audienceRoles: [admin, admin_assistant]
tags: [patients, people, management]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [clients, patients list, add patient]
---

## When to use this

- You need to add a new {{labels.patient.singular}} to your organization.
- You want to view, search, or filter your {{labels.patient.plural}} list.
- You need to update a {{labels.patient.singular}}'s session frequency or requirements.
- You need to activate or deactivate a {{labels.patient.singular}}.

## How it works

The {{labels.patient.plural}} page displays all {{labels.patient.plural}} in your organization in a searchable, filterable table. You can add new {{labels.patient.plural}} using either voice commands or a form. Each {{labels.patient.singular}} has a profile page where you can edit their details and scheduling preferences.

The scheduling engine uses {{labels.patient.singular}} information to generate schedules. For example, session frequency determines how many sessions to schedule per week, and required {{labels.certification.plural}} are matched against {{labels.staff.singular}} qualifications.

## Steps

### View your {{labels.patient.plural}}

1. Navigate to **{{labels.patient.plural}}** in the main menu.
2. The table displays all {{labels.patient.plural}} with their name, gender, sessions per week, required {{labels.certification.plural}}, {{labels.staff.singular}} gender preference, and status.
3. Use the search box to find {{labels.patient.plural}} by name.
4. Use the **Status** dropdown to filter by Active or Inactive.
5. Use the **Gender** dropdown to filter by Male or Female.

### Add a {{labels.patient.singular}} using voice

1. On the {{labels.patient.plural}} page, click the microphone button or select **Speak**.
2. Say a command like "Add a new {{labels.patient.singular}} named Emily Carter, female" or "New {{labels.patient.singular}} Michael Brown, male, needs 3 sessions per week".
3. Review the AI interpretation that appears.
4. Click **Add {{labels.patient.singular}}** to confirm, or click **Edit Details** to modify the information before saving.
5. Click **Cancel** to discard and try again.

### Add a {{labels.patient.singular}} using the form

1. Click the **Add {{labels.patient.singular}}** button in the top right corner.
2. Enter the following information:
   - **{{labels.patient.singular}} Name** (required)
   - **Gender** – select Male or Female
   - **Sessions Per Week** – how many sessions this {{labels.patient.singular}} needs each week (default is 2)
   - **{{labels.staff.singular}} Gender Preference** – restrict scheduling to a specific {{labels.staff.singular}} gender, or select "No Preference"
   - **Notes** (optional) – any special requirements or information
3. Click **Add {{labels.patient.singular}}** to save.

### View a {{labels.patient.singular}}'s profile

1. From the {{labels.patient.plural}} list, click **View** next to the {{labels.patient.singular}} you want to see.
2. The profile page displays personal information, scheduling preferences, and related settings.

### Activate or deactivate a {{labels.patient.singular}}

1. Open the {{labels.patient.singular}}'s profile page.
2. Toggle the **Status** switch to Active or Inactive.
3. Inactive {{labels.patient.plural}} are excluded from schedule generation.

## How this changes with your settings

### Voice input vs. typed commands

You can add {{labels.patient.plural}} by speaking naturally or by typing a command. The voice interface includes **Speak** and **Type** modes. Example commands:

- "Add a new {{labels.patient.singular}} named Emily Carter, female"
- "New {{labels.patient.singular}} Michael Brown, male, needs 3 sessions per week"
- "Add {{labels.patient.singular}} Lisa Wong who requires an ABA certified {{labels.staff.singular}}"

If microphone access is blocked or voice transcription isn’t configured, use **Type** mode or the **Add {{labels.patient.singular}}** form.

## Related

- [/help/people/patient-preferences](/help/people/patient-preferences)
- [/help/people/staff](/help/people/staff)
- [/help/rules/categories](/help/rules/categories)
- [/help/schedules/generate](/help/schedules/generate)
- [/help/voice/overview](/help/voice/overview)

## Troubleshooting

- **"No {{labels.patient.plural}} found"** – Check your search query and filters. Clear the search box or reset the Status/Gender dropdowns to "All" to see the full list.
- **Voice command not understood** – Speak clearly and use natural language. If the AI interpretation is incorrect, click **Edit Details** to correct it before saving, or click **Cancel** and try again.
- **Microphone not working** – Ensure your browser has permission to access the microphone. If voice input continues to fail, switch to **Type** mode to enter your command as text.
- **Cannot add {{labels.patient.singular}}** – Verify you have admin or assistant permissions. Only users with the appropriate role can manage {{labels.patient.plural}}.
- **{{labels.patient.singular}} not appearing in schedule** – Check that the {{labels.patient.singular}}'s status is set to Active. Also verify that there are {{labels.staff.plural}} available who meet the {{labels.patient.singular}}'s requirements (e.g., required {{labels.certification.plural}}, gender preference).
