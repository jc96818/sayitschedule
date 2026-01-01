---
id: help.rooms.capabilities
slug: /help/rooms/capabilities
title: "{{labels.room.singular}} capabilities and matching"
category: rooms
summary: How {{labels.room.singular}} capabilities and {{labels.patient.singular}} requirements influence scheduling.
audienceRoles: [admin, admin_assistant]
tags: [rooms, capabilities, matching, equipment]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [equipment, features, capabilities, room matching]
---

## When to use this

- You want to understand how {{labels.room.singular}} capabilities affect schedule generation.
- You need to add or edit capabilities for a {{labels.room.singular}}.
- You want to set up {{labels.patient.singular}} requirements that match specific {{labels.room.singular}} features.
- You need to troubleshoot why a {{labels.patient.singular}} is being scheduled in certain {{labels.room.plural}}.

## How it works

{{labels.room.plural}} can have **capabilities** – tags that describe what features, equipment, or special accommodations the {{labels.room.singular}} offers. These capabilities are matched against {{labels.patient.singular}} requirements during schedule generation.

### The matching process

1. When you add a capability to a {{labels.room.singular}}, that {{labels.room.singular}} becomes eligible for {{labels.patient.plural}} who require that capability.
2. When you set a required {{labels.room.singular}} capability for a {{labels.patient.singular}}, only {{labels.room.plural}} with that capability will be considered for their sessions.
3. During schedule generation, the scheduler finds {{labels.room.plural}} that have **all** the capabilities a {{labels.patient.singular}} requires.

### Capability types

Capabilities are free-form text tags. Common examples include:

| Capability | Description |
|------------|-------------|
| wheelchair_accessible | {{labels.room.singular}} is accessible for wheelchairs |
| sensory_equipment | {{labels.room.singular}} has sensory integration equipment |
| computer_station | {{labels.room.singular}} has computer or tablet equipment |
| therapy_swing | {{labels.room.singular}} has a therapy swing |
| quiet_room | {{labels.room.singular}} is soundproofed or low-stimulation |
| large_space | {{labels.room.singular}} is larger than standard |
| outdoor_access | {{labels.room.singular}} has direct access to outdoor space |
| video_recording | {{labels.room.singular}} is set up for session recording |

Your organization can define custom capabilities based on your specific equipment and needs.

## Steps

### Add capabilities to a {{labels.room.singular}}

1. Navigate to **{{labels.room.plural}}** in the main menu.
2. Click **View** next to the {{labels.room.singular}} you want to edit.
3. Click **Edit {{labels.room.singular}}** in the top right corner.
4. In the **Capabilities** section:
   - Type a capability name and click **Add**, or press Enter
   - Click a suggestion button to add common capabilities
5. Click **Save Changes**.

### Remove capabilities from a {{labels.room.singular}}

1. Open the {{labels.room.singular}}'s profile page.
2. Click **Edit {{labels.room.singular}}**.
3. Click a capability badge to remove it.
4. Click **Save Changes**.

### Set {{labels.room.singular}} capability requirements for a {{labels.patient.singular}}

1. Navigate to **{{labels.patient.plural}}** in the main menu.
2. Click **View** next to the {{labels.patient.singular}} you want to edit.
3. Click **Edit Profile**.
4. In the **Required {{labels.room.singular}} Capabilities** section:
   - Type a capability name and click **Add**, or press Enter
   - Click a suggestion button to add common capabilities
5. Click **Save Changes**.

The scheduler will only assign this {{labels.patient.singular}} to {{labels.room.plural}} that have all the required capabilities.

### Set a preferred {{labels.room.singular}} for a {{labels.patient.singular}}

If a {{labels.patient.singular}} prefers a specific {{labels.room.singular}} (regardless of capabilities):

1. Open the {{labels.patient.singular}}'s profile page.
2. Click **Edit Profile**.
3. In the **Preferred {{labels.room.singular}}** dropdown, select the {{labels.room.singular}}.
4. Click **Save Changes**.

The scheduler will try to use the preferred {{labels.room.singular}} when it's available, but required capabilities still take priority.

## How this changes with your settings

### Suggested {{labels.equipment.plural}}

Your organization can configure a list of suggested {{labels.equipment.plural}} (capabilities) in Settings. When you add capabilities to a {{labels.room.singular}} or requirements to a {{labels.patient.singular}}, these suggestions appear as quick-add buttons. This helps ensure consistent naming across your organization.

If no custom suggestions are configured, the system provides default suggestions like wheelchair_accessible, sensory_equipment, and computer_station.

## Related

- `/help/rooms/rooms`
- `/help/people/patient-preferences`
- `/help/settings/suggested-equipment`
- `/help/schedules/generate`

## Troubleshooting

- **{{labels.patient.singular}} not getting required {{labels.room.singular}}** – Verify that at least one active {{labels.room.singular}} has all the required capabilities. If no {{labels.room.singular}} matches, schedule generation won’t be able to place sessions in a {{labels.room.singular}} that meets those requirements.
- **Capability not matching** – Capability names must match exactly. Check for typos, extra spaces, or different naming conventions (e.g., "wheelchair accessible" vs "wheelchair_accessible").
- **Too few {{labels.room.plural}} available** – If you've added many required capabilities to {{labels.patient.plural}}, you may have limited the available {{labels.room.plural}} too much. Consider which capabilities are truly required vs. preferred.
- **Preferred {{labels.room.singular}} not used** – The preferred {{labels.room.singular}} setting is a preference, not a requirement. If the {{labels.room.singular}} is already booked or doesn't meet required capabilities, another {{labels.room.singular}} will be used.
