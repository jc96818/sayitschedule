---
id: help.rules.create
slug: /help/rules/create
title: Create rules (UI)
category: rules
summary: Create and manage rules using the Rules page.
audienceRoles: [admin, admin_assistant]
tags: [rules, create, voice]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [add rule, new rule]
---

## When to use this

- You want to add a new scheduling constraint or preference.
- You want to add multiple rules quickly using voice (or typed commands).
- You need to edit, disable, or delete an existing rule.

## How it works

Rules can be created in two ways:

- **Voice/typed commands**: the app parses a single command into one or more proposed rules, then you confirm/reject/edit before creating them.
- **Manual form**: you pick a category, write a description, and set a priority.

Either way, the most important part is the **rule description**—it’s what the scheduler and analysis features use to understand your intent.

## Steps

### Create rules with voice (or typed commands)

1. Open **Rules** from the sidebar.
2. In the voice input panel, use **Speak** (microphone) or **Type** to enter a command.
3. Review the **AI Interpretation** card:
   - A single command can produce multiple rules.
   - Each rule includes a confidence score and may include warnings.
4. For each proposed rule:
   - **Confirm** it, **Reject** it, or **Edit Details** to adjust category/description/priority.
5. Click **Create _N_ Rule(s)** to save the confirmed rules.

### Search rules using voice/typed input

On the Rules page, some phrases are treated as search intent (for example “find rules about certifications”). When detected, the app will populate the search box instead of creating rules.

### Create a rule manually

1. Open **Rules** and click **Add Rule**.
2. Choose a **Category** (see `/help/rules/categories`).
3. Write a clear **Rule Description** (one idea per rule).
4. Set a **Priority**.
5. Click **Add Rule**.

### Edit, disable, or delete an existing rule

1. Find the rule using category tabs, search, and the Active/Inactive filter.
2. Use the toggle to enable/disable the rule.
3. Use **Edit** to change category/description/priority.
4. Use **Delete** to remove the rule.

### Analyze rules (conflicts, duplicates, suggestions)

1. Open **Rules**.
2. Click **Analyze Rules**.
3. Review the findings:
   - **Conflicts**: rules that appear to contradict each other.
   - **Duplicates**: rules that appear to say the same thing.
   - **Suggested enhancements**: rule ideas that may fill important gaps.
4. Use the built-in actions to deactivate rules or add suggested rules.

## How this changes with your settings

- If microphone access is blocked (or transcription isn’t configured), use **Type** mode.
- If AI-backed features aren’t configured, voice parsing and AI analysis may fail; you can still create rules manually.

## Related

- `/help/rules/overview`
- `/help/rules/categories`
- `/help/voice/overview`

## Troubleshooting

- **“Could not understand the command”**: simplify the command into one or two sentences, or create the rule manually.
- **The app created too many rules from one command**: use **Reject** on the extras, and re-run the command with fewer “and/also” clauses.
- **Voice input switches to Type**: the app does this when microphone/transcription errors occur; keep using **Type** or fix microphone permissions.
- **AI analysis shows conflicts/duplicates you disagree with**: treat analysis as advisory; only deactivate rules you truly want removed.
