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

Say It Schedule is a scheduling platform built for therapy practices and similar healthcare settings. It helps you manage {{labels.staff.plural}}, {{labels.patient.plural}}, and {{labels.room.plural}}, then generate optimized weekly schedules that respect availability, rules, and constraints.

The app is designed around three core principles:

1. **Voice-first workflow**: Speak your scheduling requests naturally instead of clicking through menus.
2. **Rule-based scheduling**: Define your constraints once, and the system respects them every time.
3. **Review before publish**: Every change goes through a clear review step before it affects the live schedule.

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
- **Conflict detection**: See warnings when rules can't all be satisfied.

<!-- help:when features.voiceCommandsEnabled -->

### Voice commands

Speak naturally to make changes:

- "Add a patient named Sarah who needs two sessions per week"
- "Schedule Jordan on Tuesday at 2pm in Room 3"
- "Move the Wednesday morning session to Thursday"

The app interprets your request, shows you what it understood, and lets you confirm before making changes.

<!-- help:end -->

<!-- help:when features.patientPortalEnabled -->

### Patient portal

Give {{labels.patient.plural}} or their caregivers a way to:

- View upcoming appointments
- Confirm attendance
- Cancel or reschedule (if enabled)
- Book new appointments (if self-booking is enabled)

<!-- help:end -->

## Who uses Say It Schedule?

The app supports different roles with different levels of access:

| Role | Primary tasks |
| ---- | ------------- |
| Admin | Full control: manage people, rules, schedules, and settings |
| Admin Assistant | Day-to-day scheduling: manage people, rules, and schedules |
| Staff | View their own schedule and request time off |

## Getting started checklist

If you're setting up Say It Schedule for the first time:

1. **Add your {{labels.staff.plural}}**: Create profiles for everyone who provides sessions.
2. **Add your {{labels.patient.plural}}**: Enter the people who need to be scheduled.
3. **Set up {{labels.room.plural}}**: Define your physical spaces (if applicable).
4. **Create rules**: Define the constraints that matter to your practice.
5. **Generate your first schedule**: Let the system create a schedule based on your data and rules.
6. **Review and publish**: Check the generated schedule and publish when ready.

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
