---
id: help.schedules.generate
slug: /help/schedules/generate
title: Generate a schedule
category: schedules
summary: Generate a new schedule based on {{labels.staff.singular}} availability, {{labels.patient.singular}} needs, and rules.
audienceRoles: [admin, admin_assistant]
tags: [schedules, generate, ai]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [create schedule, build schedule, new schedule]
---

## When to use this

- You're building a new schedule for an upcoming week.
- You want the system to automatically assign sessions based on {{labels.staff.singular}} availability, {{labels.patient.singular}} needs, {{labels.certification.plural}}, and scheduling rules.
- You need to generate a draft schedule to review before publishing.

## How it works

Schedule generation uses AI to create optimized weekly schedules. The system considers:

- **Active {{labels.staff.plural}}**: Their working hours, {{labels.certification.plural}}, and approved time-off.
- **Active {{labels.patient.plural}}**: Their session frequency requirements, required {{labels.certification.plural}}, preferred times, and room capability needs.
- **Scheduling rules**: Your organization's active rules guide session assignments.
- **{{labels.room.plural}}**: If configured, rooms are assigned based on {{labels.patient.singular}} requirements and availability.

The generation process enforces **hard constraints** that cannot be violated:

- No overlapping sessions for a {{labels.staff.singular}} or {{labels.patient.singular}}.
- Sessions must fit within a {{labels.staff.singular}}'s working hours.
- {{labels.staff.plural}} must have required {{labels.certification.plural}} for each {{labels.patient.singular}}.
- Approved time-off must be respected.
- If rooms are assigned, they can't overlap and must have required capabilities.

After generation, the schedule is created as a **draft** so you can review and modify it before publishing.

## Steps

### Generate a schedule from the Generate page

1. Open **Schedule** from the sidebar.
2. Click **Generate New** (or navigate directly to `/app/schedule/generate`).
3. On the **Schedule Configuration** screen, you'll see summary cards showing:
   - Number of active {{labels.staff.plural}}
   - Number of active {{labels.patient.plural}}
   - Number of active rules
4. Select a **Week Start Date** (must be a Monday, defaults to next Monday).
5. Click **Generate Schedule**.
6. Wait for the AI to process. You'll see progress updates:
   - Loading staff and patient data
   - Analyzing scheduling rules
   - AI is optimizing assignments
   - Validating constraints
   - Finalizing schedule
7. Review the **Schedule Preview**:
   - Summary stats show total sessions, {{labels.patient.plural}} scheduled, and {{labels.staff.plural}} assigned.
   - A calendar grid shows all session assignments.
   - Any warnings from the scheduler appear at the top.
8. If satisfied, click **Publish Schedule** to make it live.
9. If you want to start over, click **Start Over**.

### Generate a schedule using voice

1. Open **Schedule** and navigate to a week with no existing schedule.
2. In the voice input panel, use **Speak** or **Type** to enter a command like:
   - "Generate a schedule for next week"
   - "Create a schedule for January 15th"
3. Review the parsed week in the confirmation dialog.
4. Click **Generate Schedule** to proceed.

## How this changes with your settings

- **{{labels.certification.plural}}**: The scheduler enforces that {{labels.staff.plural}} have the required {{labels.certification.plural}} for each {{labels.patient.singular}}.
- **{{labels.room.plural}} and capabilities**: If {{labels.patient.plural}} require specific {{labels.equipment.plural}} or room capabilities, the scheduler tries to assign appropriate rooms.
- **Rules**: Your active scheduling rules guide the AI's decisions. More specific and consistent rules lead to better schedules.
- **AI provider**: Schedule generation requires an AI provider to be configured. If not configured, generation will fail.

## Related

- `/help/rules/overview`
- `/help/schedules/view`
- `/help/people/staff-profile`
- `/help/people/patient-preferences`

## Troubleshooting

- **"No active staff members found"**: You need at least one active {{labels.staff.singular}} with working hours configured.
- **"No active patients found"**: You need at least one active {{labels.patient.singular}}.
- **Generation fails or takes too long**: Check that your AI provider is configured and available. Try again later if the service is temporarily unavailable.
- **Warnings about {{labels.patient.plural}} with fewer sessions than requested**: The scheduler may not find valid slots for all sessions due to {{labels.staff.singular}} availability, {{labels.certification.plural}} requirements, or conflicting rules.
- **Sessions appear in unexpected slots**: Review your rules for conflicts using **Analyze Rules** on the Rules page, and verify {{labels.staff.singular}} working hours and availability overrides.
