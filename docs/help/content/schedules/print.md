---
id: help.schedules.print
slug: /help/schedules/print
title: Print/export schedules
category: schedules
summary: Print or export schedules for sharing and distribution.
audienceRoles: [admin, admin_assistant, staff]
tags: [schedules, print, export, pdf]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [pdf, print schedule, export schedule]
---

## When to use this

- You need a physical copy of the schedule to post or distribute.
- You want to share the schedule with someone who doesn't have app access.
- You need to archive a schedule as a PDF document.

## How it works

The print view creates a single-page landscape layout optimized for printing. It includes:

- **Header**: Organization name, week date range, and schedule status (Draft/Published).
- **Schedule grid**: A table showing time slots (rows) and weekdays (columns) with all sessions.
- **Footer**: Summary statistics (total sessions, {{labels.staff.plural}} scheduled, {{labels.patient.plural}} covered) and the generation date.

Federal holidays are highlighted in the grid with a light red background and the holiday name displayed in the column header.

## Steps

### Print a schedule

1. Open **Schedule** from the sidebar.
2. Navigate to the week you want to print.
3. Click **Print** in the header actions.
4. A new browser tab opens with the print-optimized view.
5. Click **Print Schedule** (or use your browser's print dialog: Ctrl+P / Cmd+P).
6. Select your printer and print settings (landscape orientation is recommended).
7. Click **Print**.

### Download a schedule as PDF

1. Open **Schedule** and navigate to the desired week.
2. Click **Download PDF** in the header actions.
3. The system generates a PDF file and downloads it to your device.

### Close the print view

1. After printing, click **Close** to close the print preview tab.
2. Alternatively, simply close the browser tab.

## What's included in the printout

| Element | Description |
|---------|-------------|
| Organization name | Your organization's name appears in the header. |
| Week range | The date range for the schedule (e.g., "Jan 6, 2025 - Jan 10, 2025"). |
| Status badge | Shows "Published" or "Draft" with version number if applicable. |
| Time slots | Standard time slots (9:00 AM, 10:00 AM, 11:00 AM, 1:00 PM, 2:00 PM, 3:00 PM). |
| Sessions | Each session shows the {{labels.staff.singular}} name, {{labels.patient.singular}} name, and {{labels.room.singular}} (if assigned). |
| Holidays | Federal holidays are highlighted and labeled. |
| Statistics | Session count, {{labels.staff.plural}} count, and {{labels.patient.plural}} count. |
| Generation date | The date when the printout was generated. |

## How this changes with your settings

- **Custom labels**: The footer statistics use your organization's terminology for {{labels.staff.plural}} and {{labels.patient.plural}}.
- **Organization name**: Your organization's name appears in the print header.

## Related

- `/help/schedules/view`
- `/help/schedules/generate`

## Troubleshooting

- **Print button is disabled**: You need to have a schedule for the selected week. Generate a schedule first.
- **Sessions are cut off or too small**: Ensure your print settings use landscape orientation. The layout is optimized for standard letter/A4 paper in landscape mode.
- **Can't see all sessions**: The print view uses a compact layout. If you have many sessions per time slot, some may be truncated. Consider filtering by {{labels.staff.singular}} or {{labels.room.singular}} before printing for a cleaner view.
- **PDF download fails**: Check your browser's download settings and permissions. Try using the Print option and selecting "Save as PDF" as the destination instead.
