---
id: help.getting-started.overview
slug: /help/getting-started/overview
title: What is Say It Schedule?
category: getting-started
summary: An overview of what Say It Schedule does and how it fits into your scheduling workflow.
audienceRoles: [admin, admin_assistant, staff]
tags: [getting-started, overview, introduction]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [what is, overview, introduction, about]
---

## When to use this

- You're new to the app and want the big picture.
- You want to understand core concepts like {{labels.staff.plural}}, {{labels.patient.plural}}, schedules, and rules.
- You're evaluating Say It Schedule for your practice.

## How it works

Say It Schedule helps you manage {{labels.staff.plural}}, {{labels.patient.plural}}, and {{labels.room.plural}}, then generate weekly schedules based on availability and rules.

## Core features

### Manage your practice data

- **{{labels.staff.plural}}**: Add your team members with their qualifications, certifications, and default working hours.
- **{{labels.patient.plural}}**: Track who needs sessions, how often, and any special requirements.
- **{{labels.room.plural}}**: Define your physical spaces and their capabilities (equipment, accessibility).

### Define scheduling rules

Rules are constraints that the schedule generator respects automatically:

- **Gender pairing**: Match {{labels.patient.plural}} with {{labels.staff.plural}} of a specific gender.
- **Certification requirements**: Ensure {{labels.patient.plural}} only see {{labels.staff.plural}} with required qualifications.
- **Specific pairings**: Assign certain {{labels.patient.plural}} to specific {{labels.staff.plural}}.
- **Session constraints**: Control timing, duration, and frequency.

### Generate and manage schedules

- **Automatic generation**: The system creates schedules that satisfy as many rules as possible.
- **Draft and publish workflow**: Review generated schedules before making them official.

## Who uses Say It Schedule?

The app supports different roles with different levels of access:

| Role | Primary tasks |
| ---- | ------------- |
| Admin | Full control: manage people, rules, schedules, and settings |
| Admin Assistant | Day-to-day scheduling: manage people, rules, and schedules |
| Staff | View their own schedule and request time off |

## Steps

If you're setting up Say It Schedule for the first time:

1. **Add your {{labels.staff.plural}}**: Create profiles for everyone who provides sessions.
2. **Add your {{labels.patient.plural}}**: Enter the people who need to be scheduled.
3. **Set up {{labels.room.plural}}**: Define your physical spaces (if applicable).
4. **Create rules**: Define the constraints that matter to your practice.
5. **Generate your first schedule**: Let the system create a schedule based on your data and rules.
6. **Review and publish**: Check the generated schedule and publish when ready.

## How this changes with your settings

<!-- help:when features.voiceCommandsEnabled -->
### Voice commands

If voice input is enabled and configured for your organization, you can speak (or type) commands in a voice input panel. The app will show what it understood before you confirm changes.
<!-- help:end -->

<!-- help:when features.patientPortalEnabled -->
### Patient portal

If the patient/caregiver portal is enabled, {{labels.patient.plural}} (or their caregivers) can sign in to view appointments and (optionally) request or book appointments depending on your self-booking settings.
<!-- help:end -->

## Key concepts

- **Organization**: Your practice. Each organization has its own data, users, and settings.
- **Schedule**: A collection of sessions for a specific week.
- **Session**: A single appointment between a {{labels.staff.singular}} and {{labels.patient.singular}}.
- **Rule**: A constraint or preference that guides schedule generation.

For detailed definitions, see the [Glossary](/help/getting-started/glossary).

## Related

- [/help/getting-started/glossary](/help/getting-started/glossary)
- [/help/getting-started/roles](/help/getting-started/roles)
- [/help/schedules/generate](/help/schedules/generate)
- [/help/rules/overview](/help/rules/overview)

## Troubleshooting

- **You can’t find a page mentioned here**: Some pages are role-restricted. See [/help/getting-started/roles](/help/getting-started/roles).
- **Voice input isn’t working**: Check microphone permissions and try **Type** mode; see `/help/troubleshooting/voice`.
