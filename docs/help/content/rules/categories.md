---
id: help.rules.categories
slug: /help/rules/categories
title: Rule categories and priorities
category: rules
summary: Learn what rule categories mean and how priority affects schedule generation.
audienceRoles: [admin, admin_assistant]
tags: [rules, priority, categories]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [rule priority, categories]
---

## When to use this

- You’re choosing a category for a new rule.
- You want to keep your rule set organized and searchable.
- You’re trying to understand how priority affects ordering.

## How it works

Each rule has a **category** and a **priority**:

- **Category** helps you (and the app) group rules by intent. It’s used for filtering, searching, and AI analysis.
- **Priority** is a numeric hint used to order rules when they’re listed and passed into scheduling/analysis.

In the current implementation, rules are ordered by **priority first**, then by creation time. Use a consistent scheme in your organization so “more important” rules reliably appear earlier in the list.

## Categories

These are the standard categories currently supported:

| Category | Best for | Example rule descriptions |
|---|---|---|
| `gender_pairing` | Gender matching preferences between {{labels.patient.plural}} and {{labels.staff.plural}} | “Female {{labels.patient.plural}} should be paired with female {{labels.staff.plural}} when possible.” |
| `session` | Timing and session-shape constraints | “Maximum 2 sessions per {{labels.staff.singular}} per day.” |
| `availability` | Availability-related constraints not captured by default hours or time-off | “Debbie is only available on Wednesdays.” |
| `specific_pairing` | Explicit person-to-person assignments | “Always schedule John with Sarah.” |
| `certification` | Policy-style certification constraints | “{{labels.staff.plural}} must have the required {{labels.certification.plural}} for each {{labels.patient.singular}}.” |

Tip: when the constraint is truly per-person and structured (like a {{labels.patient.singular}}’s required {{labels.certification.plural}} or a {{labels.staff.singular}}’s working hours), prefer capturing it in the person’s profile/settings. Use rules to capture cross-cutting policies and preferences.

## Steps

1. When creating a rule, pick the closest category from the list above.
2. Use priority to reflect ordering/importance (choose a scale your team will use consistently).
3. Review categories periodically: if a rule’s description doesn’t match its category, recategorize it for clearer filtering and analysis.

## How this changes with your settings

No major differences. Category labels in the UI may reflect your organization’s custom terminology.

## Related

- [/help/rules/overview](/help/rules/overview)
- [/help/rules/create](/help/rules/create)

## Troubleshooting

- **Not sure which category to use**: choose the one that best matches the *intent* of the rule; the description should still be explicit.
- **Priority feels backwards**: pick a simple internal convention (for example, reserve a small band of numbers for “highest importance”) and apply it consistently across rules.
