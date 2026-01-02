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

1. Open **{{labels.room.plural}}** from the sidebar.
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

1. Click **Add {{labels.room.singular}}**.
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
2. Click **Edit {{labels.room.singular}}**.
3. Update the name, description, or capabilities as needed.
4. Click **Save Changes**.

### Activate or deactivate a {{labels.room.singular}}

1. Open the {{labels.room.singular}}'s profile page.
2. Toggle the **Status** switch to Active or Inactive.
3. Inactive {{labels.room.plural}} are not used when generating schedules.

### Delete a {{labels.room.singular}}

1. Open the {{labels.room.singular}}'s profile page.
2. Click **Delete**.
3. Confirm the deletion when prompted. This action cannot be undone.

## How this changes with your settings

### Voice input vs. typed commands

You can add {{labels.room.plural}} by speaking naturally or by typing a command. The voice interface includes **Speak** and **Type** modes. Example commands:

- "Create {{labels.room.singular}} 101 with sensory equipment"
- "Add a new {{labels.room.singular}} called Therapy Suite A with wheelchair access"
- "New {{labels.room.singular}} B2 with sensory equipment, computer station, and wheelchair access"

If microphone access is blocked or voice transcription isn’t configured, use **Type** mode or the **Add {{labels.room.singular}}** form.

## Related

- [/help/rooms/capabilities](/help/rooms/capabilities)
- [/help/people/patient-preferences](/help/people/patient-preferences)
- [/help/schedules/generate](/help/schedules/generate)
- [/help/voice/overview](/help/voice/overview)

## Troubleshooting

- **"No {{labels.room.plural}} found"**: Clear search and filters (Status) to see the full list.
- **Voice command not understood**: Try a shorter command, or use **Edit Details** to correct the parsed values before saving.
- **Cannot add {{labels.room.singular}}**: Only Admins, Admin Assistants, and Super Admins can manage {{labels.room.plural}}.
- **{{labels.room.singular}} not appearing in schedule**: Check that the {{labels.room.singular}}'s status is set to Active.
