---
id: help.people.staff-profile
slug: /help/people/staff-profile
title: "{{labels.staff.singular}} profile fields"
category: people
summary: What each field means on a {{labels.staff.singular}} profile and how it impacts scheduling.
audienceRoles: [admin, admin_assistant]
tags: [staff, profile, fields, availability]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [staff profile, therapist profile, staff fields]
---

## When to use this

- You want to understand what each field on a {{labels.staff.singular}} profile means.
- You need to update a {{labels.staff.singular}}'s personal information, {{labels.certification.plural}}, or working hours.
- You want to manage time off requests for a {{labels.staff.singular}}.
- You need to activate or deactivate a {{labels.staff.singular}}.

## How it works

Each {{labels.staff.singular}} has a profile page that displays their personal information, {{labels.certification.plural}}, default working hours, and time off calendar. The information on this page is used by the scheduling engine when generating schedules. For example, {{labels.certification.plural}} are matched to {{labels.patient.singular}} requirements, and working hours determine when a {{labels.staff.singular}} can be scheduled.

## Key fields

### Personal Information

| Field | Description | Impact on scheduling |
|-------|-------------|---------------------|
| **Full Name** | The {{labels.staff.singular}}'s display name | Shown on schedules and in dropdowns |
| **Gender** | Male or Female | Used for gender pairing rules if configured |
| **Email** | Contact email address | Used for identification and communication |
| **Phone** | Contact phone number | Used for identification and communication |
| **Hire Date** | When the {{labels.staff.singular}} was hired | For reference only; does not affect scheduling |
| **Status** | Active or Inactive | Inactive {{labels.staff.plural}} are excluded from scheduling |

### {{labels.certification.plural}}

{{labels.certification.plural}} are tags that describe a {{labels.staff.singular}}'s qualifications (e.g., "ABA Therapy", "Speech Therapy", "Pediatrics"). When generating schedules, the system matches {{labels.staff.singular}} {{labels.certification.plural}} to {{labels.patient.singular}} requirements.

- If a {{labels.patient.singular}} has required {{labels.certification.plural}}, only {{labels.staff.plural}} with those required {{labels.certification.plural}} will be considered.
- {{labels.staff.plural}} without any {{labels.certification.plural}} can still be scheduled with {{labels.patient.plural}} who have no requirements.

### Default Working Hours

Default working hours define when a {{labels.staff.singular}} is typically available each day of the week (Monday through Friday). For each day, you can:

- **Enable the day** – Mark it as a working day with specific start and end times.
- **Disable the day** – Mark it as a day off (the {{labels.staff.singular}} won't be scheduled on that day).

These are default hours only. You can override them for specific dates using time off requests.

### Time Off & Availability

The availability calendar shows time off requests for the {{labels.staff.singular}}. Each request can be:

- **Full day** – The {{labels.staff.singular}} is unavailable for the entire day.
- **Partial day** – The {{labels.staff.singular}} is unavailable during specific hours.

Time off requests have a status:

- **Pending** – Awaiting approval from an administrator.
- **Approved** – The time off is confirmed and the {{labels.staff.singular}} won't be scheduled.
- **Rejected** – The request was declined.

## Steps

### Edit personal information

1. Open the {{labels.staff.singular}}'s profile page.
2. Click **Edit Profile** in the top right.
3. Update the fields as needed: Full Name, Gender, Email, Phone, or Hire Date.
4. Click **Save Changes**.

### Update {{labels.certification.plural}}

1. Open the {{labels.staff.singular}}'s profile page.
2. Click **Edit Profile**.
3. In the {{labels.certification.plural}} section, add or remove tags.
4. Click **Save Changes**.

### Set default working hours

1. Open the {{labels.staff.singular}}'s profile page.
2. In the **Default Working Hours** section, click **Edit Hours**.
3. For each day of the week:
   - Check the box to mark the day as a working day.
   - Set the start and end times.
   - Uncheck the box to mark the day as off.
4. Click **Save Hours**.

### Request time off

1. Open the {{labels.staff.singular}}'s profile page.
2. In the **Time Off & Availability** section, click on a date in the calendar.
3. Choose whether it's a full day or partial day off.
4. If partial, enter the start and end times for when the {{labels.staff.singular}} is unavailable.
5. Optionally enter a reason (e.g., "Doctor's appointment", "Vacation").
6. Click **Submit Request**.

For staff users (non-admins), the request is submitted for approval. Administrators can approve or reject pending requests.

### Edit or delete a time off request

1. Open the {{labels.staff.singular}}'s profile page.
2. Click on an existing time off request in the calendar.
3. Modify the details and click **Save Changes**, or click **Delete** to remove the request.

### Activate or deactivate a {{labels.staff.singular}}

1. Open the {{labels.staff.singular}}'s profile page.
2. In the **Personal Information** section, toggle the **Status** switch.
3. Active {{labels.staff.plural}} are available for scheduling; inactive {{labels.staff.plural}} are not.

### Delete a {{labels.staff.singular}}

1. Open the {{labels.staff.singular}}'s profile page.
2. Click the **Delete** button in the top right.
3. Confirm the deletion when prompted. This action cannot be undone.

## How this changes with your settings

This page is mostly the same for all organizations. The biggest differences you’ll see are your organization’s custom labels (for example, whether the app calls people “{{labels.staff.plural}}” or “Therapists”).

## Related

- `/help/people/staff`
- `/help/people/patient-preferences`
- `/help/rules/overview`
- `/help/schedules/generate`

## Troubleshooting

- **Cannot save working hours** – Ensure the end time is after the start time for each enabled day.
- **Time off request pending** – Staff users must wait for an administrator to approve their time off requests. Administrators can approve requests from the pending requests panel.
- **{{labels.staff.singular}} not appearing in schedule** – Check that the {{labels.staff.singular}}'s status is set to Active and they have working hours defined for the relevant days.
- **{{labels.staff.singular}} scheduled during time off** – Ensure the time off request status is "Approved". Pending or rejected requests do not block scheduling.
