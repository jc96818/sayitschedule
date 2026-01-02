---
id: help.people.patient-preferences
slug: /help/people/patient-preferences
title: "{{labels.patient.singular}} scheduling preferences"
category: people
summary: How preferences like times, {{labels.room.plural}}, and requirements affect scheduling results.
audienceRoles: [admin, admin_assistant]
tags: [patients, preferences, scheduling, requirements]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [preferred times, preferred room, patient requirements]
---

## When to use this

- You want to understand how {{labels.patient.singular}} preferences affect schedule generation.
- You need to set up scheduling requirements for a {{labels.patient.singular}}.
- You want to specify a preferred {{labels.room.singular}} or time slots for a {{labels.patient.singular}}.
- You need to require specific {{labels.room.singular}} capabilities for a {{labels.patient.singular}}'s sessions.

## How it works

Each {{labels.patient.singular}} has scheduling preferences that the scheduling engine considers when generating weekly schedules. These preferences help ensure that sessions are assigned to appropriate {{labels.staff.plural}}, {{labels.room.plural}}, and time slots.

Preferences fall into two categories:

- **Requirements** – Must be satisfied. If a requirement cannot be met, the session may not be scheduled.
- **Preferences** – Preferred but not mandatory. The scheduler will try to honor preferences when possible.

## Key fields

### Session Frequency

| Field | Description | Impact on scheduling |
|-------|-------------|---------------------|
| **Sessions Per Week** | Number of sessions to schedule each week (1–10) | Determines how many sessions appear on the weekly schedule |

### {{labels.staff.singular}} Requirements

| Field | Description | Impact on scheduling |
|-------|-------------|---------------------|
| **Required {{labels.certification.plural}}** | Qualifications the {{labels.staff.singular}} must have | Only {{labels.staff.plural}} with matching {{labels.certification.plural}} will be considered |
| **{{labels.staff.singular}} Gender Preference** | Preference for male or female {{labels.staff.plural}} | Filters available {{labels.staff.plural}} by gender (or "Any" for no preference) |

### {{labels.room.singular}} Preferences

| Field | Description | Impact on scheduling |
|-------|-------------|---------------------|
| **Preferred {{labels.room.singular}}** | A specific {{labels.room.singular}} the {{labels.patient.singular}} prefers | Scheduler will try to use this {{labels.room.singular}} when available |
| **Required {{labels.room.singular}} Capabilities** | {{labels.equipment.plural}} or features the {{labels.room.singular}} must have | Only {{labels.room.plural}} with matching capabilities will be used |

### Time Preferences

| Field | Description | Impact on scheduling |
|-------|-------------|---------------------|
| **Preferred Times** | Time slots the {{labels.patient.singular}} prefers (e.g., "morning", "afternoon") | Scheduler will try to place sessions in these time windows |

## Steps

### Edit {{labels.patient.singular}} preferences

1. Open **{{labels.patient.plural}}** from the sidebar.
2. Click **View** next to the {{labels.patient.singular}} you want to edit.
3. Click **Edit Profile**.
4. Update the preference fields as needed (described below).
5. Click **Save Changes**.

### Set required {{labels.certification.plural}}

1. Open the {{labels.patient.singular}}'s profile and click **Edit Profile**.
2. In the **Required {{labels.certification.plural}}** field, add the {{labels.certification.plural}} that a {{labels.staff.singular}} must have.
3. Only {{labels.staff.plural}} with all required {{labels.certification.plural}} will be matched to this {{labels.patient.singular}}.
4. Click **Save Changes**.

### Set a preferred {{labels.room.singular}}

1. Open the {{labels.patient.singular}}'s profile and click **Edit Profile**.
2. In the **Preferred {{labels.room.singular}}** dropdown, select the {{labels.room.singular}} you want.
3. Select "No preference" to allow any available {{labels.room.singular}}.
4. Click **Save Changes**.

### Set required {{labels.room.singular}} capabilities

1. Open the {{labels.patient.singular}}'s profile and click **Edit Profile**.
2. In the **Required {{labels.room.singular}} Capabilities** section:
   - Type a capability name and click **Add**, or
   - Click a suggestion button to add common capabilities
3. Common capability suggestions include:
   - wheelchair_accessible
   - sensory_equipment
   - computer_station
   - therapy_swing
   - quiet_room
   - large_space
   - outdoor_access
   - video_recording
4. Click a capability badge to remove it.
5. Click **Save Changes**.

### Set {{labels.staff.singular}} gender preference

1. Open the {{labels.patient.singular}}'s profile and click **Edit Profile**.
2. In the **{{labels.staff.singular}} Gender Preference** dropdown, select:
   - **No Preference** – any {{labels.staff.singular}} can be assigned
   - **Female Only** – only female {{labels.staff.plural}} will be considered
   - **Male Only** – only male {{labels.staff.plural}} will be considered
3. Click **Save Changes**.

## How this changes with your settings

The scheduling engine uses these fields when generating schedules. If preferences conflict or cannot be satisfied, the scheduler generally tries to:

1. Satisfy **requirements** first (required {{labels.certification.plural}}, required {{labels.room.singular}} capabilities).
2. Honor **preferences** when possible (preferred {{labels.room.singular}}, preferred times).
3. If requirements cannot be met, the {{labels.patient.singular}} may not be fully scheduled.

If you’re not getting the outcome you expect, review the generated schedule and adjust requirements/preferences to better reflect what’s truly required vs. preferred.

## Related

- [/help/people/patients](/help/people/patients)
- [/help/people/staff-profile](/help/people/staff-profile)
- [/help/rooms/capabilities](/help/rooms/capabilities)
- [/help/rules/overview](/help/rules/overview)
- [/help/schedules/generate](/help/schedules/generate)

## Troubleshooting

- **{{labels.patient.singular}} not appearing in schedule**: Ensure the {{labels.patient.singular}} is Active, sessions per week is greater than 0, and at least one active {{labels.staff.singular}} meets required {{labels.certification.plural}} (and any gender preference).
- **Wrong {{labels.room.singular}} assigned**: The preferred {{labels.room.singular}} may have been unavailable. Check {{labels.room.singular}} status and capabilities. Required capabilities take precedence over the preferred {{labels.room.singular}}.
- **Certification requirement not met**: Ensure at least one active {{labels.staff.singular}} has the required {{labels.certification.plural}}. If no {{labels.staff.singular}} has the required {{labels.certification.plural}}, the {{labels.patient.singular}} cannot be scheduled.
- **Cannot find capability**: {{labels.room.singular}} capabilities are free-form text. Make sure the capability name matches exactly (including underscores or spaces) between the {{labels.patient.singular}} requirement and the {{labels.room.singular}} setup.
