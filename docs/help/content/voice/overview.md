---
id: help.voice.overview
slug: /help/voice/overview
title: Voice commands overview
category: voice
summary: Use voice commands to interact with scheduling features (if enabled).
audienceRoles: [admin, admin_assistant]
tags: [voice, commands, speech]
prerequisites:
  features: [voiceCommandsEnabled]
  settings: []
  org: []
aliases: [speech, voice control, speak]
---

## When to use this

- You want to add data or modify schedules without typing.
- You find it faster to speak commands than click through forms.
- You want to use natural language to describe what you need.

## How it works

<!-- help:when features.voiceCommandsEnabled -->
Voice commands let you perform common actions by speaking naturally. The app transcribes your audio and uses AI to interpret your request. You always have a chance to review and confirm before any action is taken.

The voice input panel appears on pages that support voice commands. You can choose between two input modes:

- **Speak**: Click the microphone button, speak your command, and click again to stop.
- **Type**: Type your command in the text box and press Enter to send.

Your input mode preference is saved and remembered for future sessions.

After you speak or type a command, the AI interprets it and shows you a confirmation dialog. You can:

- **Confirm** to apply the action
- **Cancel** to discard it
- **Edit Details** (on some pages) to adjust the interpreted values before confirming
<!-- help:end -->

<!-- help:when-not features.voiceCommandsEnabled -->
Voice commands aren't enabled for your organization. Ask an administrator to enable them in organization settings.
<!-- help:end -->

## Steps

### Use voice input

1. Navigate to a page that supports voice commands (Rules, {{labels.staff.plural}}, {{labels.patient.plural}}, {{labels.room.plural}}, or Schedule).
2. In the voice input panel, ensure **Speak** is selected.
3. Click the **microphone button** to start recording.
4. Speak your command clearly at a normal pace.
5. Click the microphone button again to stop recording.
6. Wait for the transcription to complete.
7. Review the parsed command in the confirmation dialog.
8. Click **Confirm** to apply, or **Cancel** to discard.

### Use text input instead

1. In the voice input panel, click **Type**.
2. Enter your command in the text box.
3. Press **Enter** to send (or click **Send**).
4. Review and confirm as with voice input.

### View example commands

1. Click **View command examples** below the input panel.
2. A modal shows example phrases for the current page.
3. Use these as inspiration—you don't need to match them exactly.

## Supported pages and commands

Voice commands work on the following pages:

| Page | What you can do |
| ---- | --------------- |
| Rules | Create new scheduling rules, search for existing rules |
| {{labels.staff.plural}} | Add new {{labels.staff.plural}} with name, gender, and {{labels.certification.plural}} |
| {{labels.patient.plural}} | Add new {{labels.patient.plural}} with name, gender, session requirements, and {{labels.certification.plural}} needed |
| {{labels.room.plural}} | Create {{labels.room.plural}} with names and {{labels.equipment.plural}}/capabilities |
| Schedule (draft) | Move, cancel, or add sessions; reschedule by day or time |
| Schedule (no schedule) | Generate a schedule for a specific week |

### Example commands by page

**Rules:**

- "Male {{labels.staff.plural}} can only work with male {{labels.patient.plural}}"
- "Maximum 2 sessions per {{labels.staff.singular}} per day"
- "Find all rules for Emily"

**{{labels.staff.plural}}:**

- "Add a new {{labels.staff.singular}} named Sarah Johnson, female"
- "New {{labels.staff.singular}} Adam Smith, male, certified in ABA therapy"

**{{labels.patient.plural}}:**

- "Add a new {{labels.patient.singular}} named Emily Carter, female"
- "New {{labels.patient.singular}} Michael Brown, male, needs 3 sessions per week"

**{{labels.room.plural}}:**

- "Create {{labels.room.singular}} 101 with sensory {{labels.equipment.plural}}"
- "Add a new {{labels.room.singular}} called Therapy Suite A with wheelchair access"

**Schedule modifications:**

- "Move John's 9 AM session to 2 PM"
- "Cancel Sarah's Friday 10 AM"
- "Reschedule Monday's 11 AM to Wednesday"

**Schedule generation:**

- "Generate a schedule for next week"
- "Create a schedule for the week of January 13th"

## Tips for best results

- **Speak clearly** at a normal pace—you don't need to speak slowly.
- **Use natural language**—you don't need exact phrases; the AI interprets your intent.
- **Be specific** when referring to people—use full names when possible.
- **Include key details** like times, days, or requirements in your command.
- **Review before confirming**—check that the AI interpreted your command correctly.

## How this changes with your settings

- **Voice commands enabled**: This feature must be enabled for your organization. If disabled, voice input is not available.
- **Custom labels**: Example commands and hints adapt to your organization's terminology for {{labels.staff.plural}}, {{labels.patient.plural}}, and {{labels.room.plural}}.
- **Transcription provider**: Your organization may use different transcription services. The AI interpretation works the same regardless of provider.

## Related

- `/help/voice/transcription-settings`
- `/help/schedules/view`
- `/help/rules/create`

## Troubleshooting

- **"Microphone access denied"**: Your browser needs permission to use the microphone. Check your browser settings and allow microphone access for this site.
- **"Voice transcription is not configured"**: An administrator needs to configure the transcription service in organization settings.
- **"Session expired" or "Please log in again"**: Your authentication has expired. Refresh the page and log in again.
- **Command not understood correctly**: Try rephrasing with simpler language or more specific details. You can also switch to **Type** mode and enter the command as text.
- **No microphone available**: If you don't have a microphone, use **Type** mode to enter commands as text.
- **"Connection error"**: Check your internet connection and try again. The transcription service requires a stable connection.
