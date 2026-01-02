---
id: help.settings.suggested-equipment
slug: /help/settings/suggested-equipment
title: Suggested {{labels.equipment.plural}}
category: settings
summary: Manage the list of suggested {{labels.equipment.plural}} used when creating {{labels.room.plural}}.
audienceRoles: [admin, admin_assistant]
tags: [settings, equipment, rooms]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [capabilities, features, facilities, room features]
---

## When to use this

- You want to standardize the {{labels.equipment.plural}} and capabilities used across your {{labels.room.plural}}.
- You need to add common {{labels.equipment.plural}} that your {{labels.room.plural}} frequently have.
- You want to make it easier to configure {{labels.room.plural}} when adding new ones.

## How it works

Suggested {{labels.equipment.plural}} appear as quick-select options when you're adding or editing a {{labels.room.singular}}'s capabilities. This helps maintain consistency and speeds up data entry.

When adding {{labels.equipment.plural}} to a {{labels.room.singular}}, you can:

- Select from the suggested list with a single click
- Still type custom {{labels.equipment.plural}} that aren't in the list

The suggestions are organization-wide—all users see the same list.

## Steps

### Add suggested {{labels.equipment.plural}}

1. Open **Settings** from the sidebar.
2. Scroll to the **Custom Labels** section.
3. Find the **Suggested {{labels.equipment.plural}}** area.
4. Type a capability name in the input field.
5. Click **Add** or press **Enter**.
6. The capability appears as a tag below the input.
7. Click **Save Label Settings** to save your changes.

### Remove suggested {{labels.equipment.plural}}

1. In the **Suggested {{labels.equipment.plural}}** area, find the tag you want to remove.
2. Click the tag (it has an × symbol).
3. The tag is removed from the list.
4. Click **Save Label Settings** to save your changes.

## Common {{labels.equipment.plural}} examples

Depending on your practice type, you might include:

- **Accessibility**: Wheelchair access, Elevator access, Wide doorways
- **Sensory**: Sensory {{labels.equipment.plural}}, Quiet room, Dimmable lights
- **Technology**: Computer station, Video conferencing, Smart board
- **Specialized**: Physical therapy {{labels.equipment.plural}}, Treatment table, Exercise mats

## How this changes with your settings

- **Custom labels**: If you've renamed "{{labels.equipment.plural}}" to something else (like "Capabilities"), the interface will use your custom term.
- **{{labels.room.singular}} configuration**: Suggested {{labels.equipment.plural}} appear when editing any {{labels.room.singular}}'s details.
- **{{labels.patient.singular}} matching**: {{labels.patient.plural}} can require specific {{labels.equipment.plural}}, and the scheduler will assign them to {{labels.room.plural}} with matching capabilities.
- **Voice commands**: When using voice to add {{labels.room.plural}}, mentioning suggested {{labels.equipment.plural}} helps the AI recognize them accurately.

## Related

- [/help/settings/custom-labels](/help/settings/custom-labels)
- [/help/rooms/capabilities](/help/rooms/capabilities)
- [/help/rooms/rooms](/help/rooms/rooms)

## Troubleshooting

- **Suggestions not appearing when adding {{labels.room.plural}}**: Make sure you clicked **Save Label Settings** after adding suggestions.
- **Duplicate {{labels.equipment.plural}}**: The system prevents adding duplicates. If you can't add an item, it may already exist in the list.
- **Item removed from suggestions still on {{labels.room.plural}}**: Removing a suggestion doesn't remove it from {{labels.room.plural}} that already have it. You'd need to edit each {{labels.room.singular}} individually.
