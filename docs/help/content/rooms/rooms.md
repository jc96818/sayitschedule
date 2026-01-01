---
id: help.rooms.rooms
slug: /help/rooms/rooms
title: Add and manage {{labels.room.plural}}
category: rooms
summary: Create and update {{labels.room.plural}} so schedules can place sessions correctly.
audienceRoles: [admin, admin_assistant]
tags: [rooms, management]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [treatment rooms, therapy spaces, locations]
---

## When to use this

- You need to add a new {{labels.room.singular}} to your organization.
- You want to view, search, or filter your {{labels.room.plural}} list.
- You need to update a {{labels.room.singular}}'s capabilities or description.
- You need to activate or deactivate a {{labels.room.singular}}.

## How it works

The {{labels.room.plural}} page displays all {{labels.room.plural}} in your organization in a searchable, filterable table. Each {{labels.room.singular}} can have capabilities ({{labels.equipment.plural}}) that describe what features or equipment it offers. You can add new {{labels.room.plural}} using either voice commands or a form.

When generating schedules, the scheduling engine matches {{labels.patient.singular}} {{labels.room.singular}} requirements to available {{labels.room.plural}} with the appropriate capabilities.

## Steps

### View your {{labels.room.plural}}

1. Navigate to **{{labels.room.plural}}** in the main menu.
2. The table displays all {{labels.room.plural}} with their name, {{labels.equipment.plural}}, description, and status.
3. Use the search box to find {{labels.room.plural}} by name, description, or capability.
4. Use the **Status** dropdown to filter by Active or Inactive.

### Add a {{labels.room.singular}} using voice

1. On the {{labels.room.plural}} page, click the microphone button or select **Speak**.
2. Say a command like "Create {{labels.room.singular}} 101 with sensory equipment" or "Add a new {{labels.room.singular}} called Therapy Suite A with wheelchair access".
3. Review the AI interpretation that appears.
4. Click **Add {{labels.room.singular}}** to confirm, or click **Edit Details** to modify the information before saving.
5. Click **Cancel** to discard and try again.

### Add a {{labels.room.singular}} using the form

1. Click the **Add {{labels.room.singular}}** button in the top right corner.
2. Enter the following information:
   - **{{labels.room.singular}} Name** (required) – e.g., "Room 101", "Sensory Room A"
   - **Description** (optional) – a brief description of the {{labels.room.singular}}
   - **{{labels.equipment.plural}}** – capabilities or features the {{labels.room.singular}} has
3. To add capabilities:
   - Type a capability name and click **Add**, or press Enter
   - Click a suggestion button to add common capabilities
   - Click a capability badge to remove it
4. Click **Add {{labels.room.singular}}** to save.

### View a {{labels.room.singular}}'s profile

1. From the {{labels.room.plural}} list, click **View** next to the {{labels.room.singular}} you want to see.
2. The profile page displays the {{labels.room.singular}}'s information and capabilities.

### Edit a {{labels.room.singular}}

1. Open the {{labels.room.singular}}'s profile page.
2. Click **Edit {{labels.room.singular}}** in the top right corner.
3. Update the name, description, or capabilities as needed.
4. Click **Save Changes**.

### Activate or deactivate a {{labels.room.singular}}

1. Open the {{labels.room.singular}}'s profile page.
2. Toggle the **Status** switch to Active or Inactive.
3. Inactive {{labels.room.plural}} are not used when generating schedules.

### Delete a {{labels.room.singular}}

1. Open the {{labels.room.singular}}'s profile page.
2. Click the **Delete** button in the top right corner.
3. Confirm the deletion when prompted. This action cannot be undone.

## How this changes with your settings

<!-- help:when features.voiceCommandsEnabled -->
### Voice commands enabled

You can add {{labels.room.plural}} by speaking naturally. The voice interface appears at the top of the {{labels.room.plural}} page. Example commands:

- "Create {{labels.room.singular}} 101 with sensory equipment"
- "Add a new {{labels.room.singular}} called Therapy Suite A with wheelchair access"
- "New {{labels.room.singular}} B2 with sensory equipment, computer station, and wheelchair access"

If voice transcription isn't available, you can switch to the **Type** mode to enter commands as text.
<!-- help:end -->

<!-- help:when-not features.voiceCommandsEnabled -->
### Voice commands not enabled

Voice input is not enabled for your organization. Use the **Add {{labels.room.singular}}** button to open the form and enter {{labels.room.singular}} details manually. An administrator can enable voice commands in Settings.
<!-- help:end -->

## Related

- `/help/rooms/capabilities`
- `/help/people/patient-preferences`
- `/help/schedules/generate`
- `/help/voice/overview`

## Troubleshooting

- **"No {{labels.room.plural}} found"** – Check your search query and filters. Clear the search box or reset the Status dropdown to "All" to see the full list.
- **Voice command not understood** – Speak clearly and use natural language. If the AI interpretation is incorrect, click **Edit Details** to correct it before saving, or click **Cancel** and try again.
- **Cannot add {{labels.room.singular}}** – Verify you have admin or assistant permissions. Only users with the appropriate role can manage {{labels.room.plural}}.
- **{{labels.room.singular}} not appearing in schedule** – Check that the {{labels.room.singular}}'s status is set to Active.
