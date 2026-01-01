---
id: help.rules.overview
slug: /help/rules/overview
title: How scheduling rules work
category: rules
summary: Scheduling rules describe constraints and preferences that guide schedule generation and review.
audienceRoles: [admin, admin_assistant]
tags: [rules, scheduling, constraints]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [constraints, preferences]
---

## When to use this

- You want to understand how rules influence schedule generation.
- You’re troubleshooting why a generated schedule didn’t follow a preference.
- You’re deciding whether a constraint should be captured as a rule vs. as data (hours, certifications, etc.).

## How it works

A rule is a stored, organization-scoped statement with:

- **Category** (what kind of constraint it is)
- **Description** (human-readable rule text)
- **Priority** (an ordering/importance hint)
- **Active/disabled** status

Rules are used in a few places:

- **Schedule generation**: active rules are included in the scheduler’s inputs so the system can try to honor them.
- **Rule analysis**: active rules can be analyzed for conflicts, duplicates, and “missing rule” suggestions.
- **Review/debugging**: rules help explain why the scheduler chose a particular assignment (or why it struggled).

Important: rules are guidance, but the system also enforces several **hard constraints** regardless of rule text, including:

- No overlapping sessions for a {{labels.staff.singular}} or {{labels.patient.singular}}
- Sessions must fit within a {{labels.staff.singular}}’s working hours
- {{labels.staff.singular}} must have required {{labels.certification.plural}} for the {{labels.patient.singular}}
- Approved time-off/availability overrides must be respected
- If a room is assigned, rooms can’t overlap and required room capabilities must be met

If a rule conflicts with these hard constraints (or with other rules), the scheduler may not be able to satisfy it.

## Steps

1. Open **Rules** from the sidebar.
2. Use category tabs, search, and status filters to review the current rule set.
3. Keep rules that reflect real operating policies, and disable or delete rules that no longer apply.
4. If results are surprising, run **Analyze Rules** and look for conflicts/duplicates.

## How this changes with your settings

Most rule behavior is the same across organizations. The main differences are:

- Your organization’s labels (for example, whether the UI calls people {{labels.staff.plural}} or “Therapists”).
- Whether AI-backed features are configured (voice parsing and AI rule analysis require an AI provider to be configured).

## Related

- `/help/rules/categories`
- `/help/rules/create`
- `/help/schedules/generate`

## Troubleshooting

- **A rule doesn’t seem to do anything**: confirm it’s Active, and make sure the description is specific enough to be actionable.
- **Schedules violate a rule**: check whether the rule is a preference vs. a hard constraint; the scheduler always enforces hard constraints like overlaps, working hours, and required {{labels.certification.plural}}.
- **Rules contradict each other**: use **Analyze Rules** to identify conflicts/duplicates, then deactivate the rule(s) you don’t want.
- **AI analysis or voice parsing fails**: your AI provider may not be configured (or may be temporarily unavailable). Try again later or create rules manually.
