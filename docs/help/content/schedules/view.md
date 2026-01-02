---
id: help.schedules.view
slug: /help/schedules/view
title: View schedules
category: schedules
summary: View generated and published schedules and understand schedule status.
audienceRoles: [admin, admin_assistant, staff]
tags: [schedules, view, calendar]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [schedule view, published schedule, weekly schedule]
---

## When to use this

- You want to see the schedule for a particular week.
- You need to check which sessions are assigned to a specific {{labels.staff.singular}}, {{labels.patient.singular}}, or {{labels.room.singular}}.
- You want to modify a draft schedule before publishing.
- You need to create a draft copy of a published schedule to make changes.

## How it works

The Schedule page shows one week at a time. Each week can have:

- **No schedule**: The week has not been scheduled yet.
- **Draft schedule**: A generated schedule that hasn't been published. You can edit draft schedules.
- **Published schedule**: A finalized schedule that is live. To modify a published schedule, you must first create a draft copy.

Schedules display sessions in a calendar grid (Monday–Friday) or in grouped views by {{labels.staff.singular}}, {{labels.patient.singular}}, or {{labels.room.singular}}.

## Steps

### Navigate between weeks

1. Open **Schedule** from the sidebar.
2. Use the **Prev** and **Next** buttons to navigate to different weeks.
3. The current week range and schedule status (Draft/Published) appear in the header.

### View sessions in different formats

1. On a week with a schedule, use the view tabs below the header:
   - **Calendar View**: A grid showing sessions by time slot and day.
   - **By {{labels.staff.singular}}**: Sessions grouped by {{labels.staff.singular}}, with a table for each person.
   - **By {{labels.patient.singular}}**: Sessions grouped by {{labels.patient.singular}}.
   - **By {{labels.room.singular}}**: Sessions grouped by {{labels.room.singular}}.

### Filter the calendar view

1. In **Calendar View**, use the dropdown filters on the right:
   - **All {{labels.staff.plural}}** / specific {{labels.staff.singular}}: Show only sessions for one {{labels.staff.singular}}.
   - **All {{labels.room.plural}}** / specific {{labels.room.singular}}: Show only sessions in one {{labels.room.singular}}.

### Understand session colors

- **Blue** sessions indicate a male {{labels.staff.singular}}.
- **Green** sessions indicate a female {{labels.staff.singular}}.
- **Holiday cells** appear with a light red background.

### Edit a draft schedule

If the schedule is a draft, you can:

1. **Add a session manually**: Click **Add Session** and fill in the {{labels.staff.singular}}, {{labels.patient.singular}}, {{labels.room.singular}} (optional), date, and time.
2. **Use voice commands**: In the voice input panel, say things like:
   - "Move Sarah's Tuesday session to Wednesday at 2 PM"
   - "Cancel John's session on Thursday"
   - "Add a session for Maria on Friday at 9 AM with Dr. Smith"
3. **Publish**: When ready, click **Publish Schedule** to make the schedule live.

### Edit a published schedule

1. On a published schedule, click **Edit Draft Copy**.
2. The system creates a new draft copy of the schedule.
3. If any sessions violate current rules (for example, a {{labels.staff.singular}} is now on leave), the system attempts to automatically reschedule them.
4. A **Schedule Copy Report** modal shows:
   - **Rescheduled Sessions**: Sessions that were moved to comply with current rules.
   - **Removed Sessions**: Sessions that couldn't be rescheduled and were removed.
5. Review the report and add back any removed sessions manually if needed.
6. Edit the draft as needed, then publish when ready.

### View summary statistics

The stats cards below the view tabs show:

- **Total Sessions**: Number of sessions in the schedule.
- **{{labels.staff.plural}} Scheduled**: Number of distinct {{labels.staff.plural}} with assignments.
- **{{labels.patient.plural}} Covered**: Number of distinct {{labels.patient.plural}} with sessions.
- **Coverage Rate**: Percentage indicator (currently shows overall coverage).

## How this changes with your settings

- **Custom labels**: The UI uses your organization's terminology for {{labels.staff.plural}}, {{labels.patient.plural}}, and {{labels.room.plural}}.
- **Federal holidays**: Days recognized as federal holidays are highlighted in the calendar grid.

## Related

- `/help/schedules/generate`
- `/help/schedules/print`
- `/help/voice/overview`

## Troubleshooting

- **"No Schedule for This Week"**: No schedule has been generated for the selected week. Click **Generate Schedule** to create one.
- **Can't edit the schedule**: Only draft schedules can be edited directly. For published schedules, click **Edit Draft Copy** first.
- **Voice command not understood**: Try simpler commands with clear {{labels.staff.singular}}/{{labels.patient.singular}} names, days of the week, and times.
- **Sessions removed when creating a draft copy**: This happens when {{labels.staff.singular}} availability has changed (for example, approved time-off) or rules have been updated. Add removed sessions back manually using **Add Session**.
