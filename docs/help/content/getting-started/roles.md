---
id: help.getting-started.roles
slug: /help/getting-started/roles
title: Roles & permissions
category: getting-started
summary: Understand what each role can see and do in the app.
audienceRoles: [admin, admin_assistant, staff]
tags: [roles, permissions, security, access]
prerequisites:
  features: []
  settings: []
  org: []
aliases: [permissions, access, rbac, who can]
---

## When to use this

- You need to know who can edit schedules, manage {{labels.staff.plural}}, or change settings.
- You're setting up user accounts and need to assign the right role.
- You want to understand why certain menu items or features aren't visible.

## How it works

Say It Schedule uses role-based access control. Each user has exactly one role that determines what they can see and do. The app automatically shows or hides features based on the user's role.

## The four roles

### Super Admin

The highest level of access. Super Admins manage the entire Say It Schedule platform, not just a single organization.

**What Super Admins can do:**

- Create and manage multiple organizations
- Access any organization's data by switching context
- Manage business type templates (label presets)
- View and manage all users across all organizations
- Manage BAA agreements for HIPAA compliance
- Configure platform-wide settings

**Navigation visible to Super Admins:**

When viewing an organization:
- Dashboard, Schedule, Rules
- {{labels.staff.plural}}, {{labels.patient.plural}}, {{labels.room.plural}}
- Time-Off Requests
- Settings, Data Management, Users
- HIPAA BAA (if organization requires HIPAA)
- My Account

On the Super Admin dashboard:
- Organizations list
- All users
- Business type templates
- BAA management
- Leads

### Admin (Administrator)

Full access within a single organization. Admins are typically practice owners or office managers.

**What Admins can do:**

- Manage all {{labels.staff.plural}}, {{labels.patient.plural}}, and {{labels.room.plural}}
- Create, edit, and delete scheduling rules
- Generate and publish schedules
- Review and approve time-off requests
- Invite and manage users within their organization
- Configure organization settings (branding, labels, portal)
- Import and export data
- Access HIPAA BAA (if required)

**Navigation visible to Admins:**

- Dashboard, Schedule, Rules
- {{labels.staff.plural}}, {{labels.patient.plural}}, {{labels.room.plural}}
- Time-Off Requests
- Settings, Data Management, Users
- HIPAA BAA (if organization requires HIPAA)
- My Account

### Admin Assistant

Similar access to Admin, designed for staff who help with scheduling but may not need access to certain sensitive settings.

**What Admin Assistants can do:**

- Manage all {{labels.staff.plural}}, {{labels.patient.plural}}, and {{labels.room.plural}}
- Create, edit, and delete scheduling rules
- Generate and publish schedules
- Review and approve time-off requests

**What Admin Assistants cannot do:**

- Access organization settings
- Manage users or invite new team members
- Import or export organization data
- Access HIPAA BAA documents

**Navigation visible to Admin Assistants:**

- Dashboard, Schedule, Rules
- {{labels.staff.plural}}, {{labels.patient.plural}}, {{labels.room.plural}}
- Time-Off Requests
- My Account

### Staff

The most limited role, intended for {{labels.staff.plural}} who need to view their own schedule and manage their availability.

**What Staff can do:**

- View the organization schedule
- View their personal schedule (My Schedule)
- Request time off (pending admin approval)
- Update their account settings (password, MFA)

**What Staff cannot do:**

- View or edit {{labels.staff.plural}}, {{labels.patient.plural}}, or {{labels.room.plural}} lists
- Create or modify rules
- Generate or publish schedules
- Access settings or user management

**Navigation visible to Staff:**

- Dashboard, Schedule
- My Schedule
- My Account

## Permission summary table

| Action | Super Admin | Admin | Admin Assistant | Staff |
| ------ | ----------- | ----- | --------------- | ----- |
| View schedule | Yes | Yes | Yes | Yes |
| Generate/publish schedule | Yes | Yes | Yes | No |
| Manage {{labels.staff.plural}} | Yes | Yes | Yes | No |
| Manage {{labels.patient.plural}} | Yes | Yes | Yes | No |
| Manage {{labels.room.plural}} | Yes | Yes | Yes | No |
| Create/edit rules | Yes | Yes | Yes | No |
| Review time-off requests | Yes | Yes | Yes | No |
| Request own time off | Yes | Yes | Yes | Yes |
| Manage users | Yes | Yes | No | No |
| Access settings | Yes | Yes | No | No |
| Import/export data | Yes | Yes | No | No |
| Manage organizations | Yes | No | No | No |

## Changing a user's role

Only Admins and Super Admins can change user roles.

1. Go to **Users** from the sidebar.
2. Find the user you want to modify.
3. Click on their row to open user details.
4. Select a new role from the dropdown.
5. Save changes.

## Related

- [/help/security/mfa](/help/security/mfa)
- [/help/getting-started/glossary](/help/getting-started/glossary)
- [/help/settings/branding](/help/settings/branding)

## Troubleshooting

- **Menu items are missing**: Your role determines what you see. If you need access to something you can't see, ask your Admin to change your role.
- **"Access denied" when visiting a page**: You may have bookmarked or been shared a link to a page your role can't access. You'll be redirected to the dashboard.
- **Can't find the Users page**: Only Admins and Super Admins can access user management. Ask an Admin if you need someone's role changed.
