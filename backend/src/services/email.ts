import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import type { Schedule, StaffAvailability, Staff, Organization } from '@prisma/client'

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@sayitschedule.com'
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@sayitschedule.com'
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'
const APP_URL = process.env.APP_URL || 'https://sayitschedule.com'
const SES_CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || 'sayitschedule-production'

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Build a URL with the organization's subdomain
 * e.g., if APP_URL is https://sayitschedule.com and subdomain is 'demo',
 * returns https://demo.sayitschedule.com/path
 */
function buildOrgUrl(subdomain: string | undefined, path: string): string {
  if (!subdomain) {
    return `${APP_URL}${path}`
  }

  try {
    const url = new URL(APP_URL)
    // Insert subdomain before the host
    url.hostname = `${subdomain}.${url.hostname}`
    return `${url.origin}${path}`
  } catch {
    // Fallback if URL parsing fails
    return `${APP_URL}${path}`
  }
}

export interface EmailRecipient {
  email: string
  name: string
}

interface SchedulePublishedData {
  schedule: Schedule
  organization: Organization
  staff: Array<{ name: string; email: string | null }>
  timezone?: string
}

interface TimeOffRequestData {
  availability: StaffAvailability
  staff: Staff
  organization: Organization
  timezone?: string
}

interface TimeOffReviewedData {
  availability: StaffAvailability
  staff: Staff
  organization: Organization
  approved: boolean
  reviewerNotes?: string | null
  timezone?: string
}

interface UserInvitationData {
  user: {
    email: string
    name: string
  }
  organization: {
    name: string
    subdomain: string
    primaryColor?: string
  } | null
  token: string
  invitedByName: string
}

interface PasswordResetData {
  user: {
    email: string
    name: string
  }
  organization: {
    name: string
    subdomain: string
    primaryColor?: string
  } | null
  token: string
}

interface SuperAdminInvitationData {
  user: {
    email: string
    name: string
  }
  token: string
  invitedByName: string
}

interface LeadNotificationData {
  id: string
  name: string
  email: string
  company?: string | null
  phone?: string | null
  role?: string | null
  message?: string | null
  createdAt: Date
}

/**
 * Send an email using AWS SES
 */
async function sendEmail(
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    console.log(`[Email] Skipping email (disabled): ${subject}`)
    return true
  }

  const recipients = Array.isArray(to) ? to : [to]
  const validRecipients = recipients.filter(email => email && email.includes('@'))

  if (validRecipients.length === 0) {
    console.log(`[Email] No valid recipients for: ${subject}`)
    return false
  }

  try {
    const command = new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: {
        ToAddresses: validRecipients
      },
      ReplyToAddresses: [EMAIL_REPLY_TO],
      ConfigurationSetName: SES_CONFIGURATION_SET,
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      }
    })

    await sesClient.send(command)
    console.log(`[Email] Sent: ${subject} to ${validRecipients.join(', ')}`)
    return true
  } catch (error) {
    console.error(`[Email] Failed to send: ${subject}`, error)
    return false
  }
}

/**
 * Format a date for display in a specific timezone
 */
function formatDate(date: Date | string, timezone: string = 'America/New_York'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format a week start date for display in a specific timezone
 */
function formatWeekStart(date: Date | string, timezone: string = 'America/New_York'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function sanitizeBrandColor(color: string | null | undefined, fallback: string): string {
  if (!color) return fallback
  const trimmed = color.trim()
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) return trimmed.toLowerCase()
  if (
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(
      trimmed
    )
  ) {
    return trimmed
  }
  return fallback
}

function renderEmailButton(href: string, label: string, color: string): string {
  const safeHref = escapeHtml(href)
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
    <tr>
      <td bgcolor="${color}" style="border-radius: 8px; mso-padding-alt: 12px 18px;">
        <a href="${safeHref}" style="display: inline-block; padding: 12px 18px; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>
`
}

function renderEmailUrlFallback(url: string, color: string): string {
  const safeUrl = escapeHtml(url)
  return `
  <p style="margin: 16px 0 0 0; font-size: 13px; color: #4b5563;">
    If the button doesn’t work, copy and paste this link into your browser:<br>
    <a href="${safeUrl}" style="color: ${color}; word-break: break-all;">${safeUrl}</a>
  </p>
`
}

function renderTransactionalEmailHtml(options: {
  brandName: string
  brandColor: string
  preheader: string
  heading: string
  bodyHtml: string
  footerHtml?: string
}): string {
  const brandName = escapeHtml(options.brandName)
  const preheader = escapeHtml(options.preheader)
  const heading = escapeHtml(options.heading)
  const footerHtml =
    options.footerHtml ??
    `<p style="margin: 0;">Sent by Say It Schedule.</p><p style="margin: 8px 0 0 0;">Need help? Reply to this email.</p>`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${heading}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f3f4f6;">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
      ${preheader}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6; padding: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width: 600px; max-width: 600px;">
            <tr>
              <td style="padding: 0 12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e7eb;">
                  <tr>
                    <td style="height: 6px; background-color: ${options.brandColor}; line-height: 6px; font-size: 6px;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 22px 0 22px; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color: #111827;">
                      <div style="font-size: 16px; font-weight: 700; letter-spacing: 0.2px;">${brandName}</div>
                      <div style="margin-top: 6px; font-size: 22px; font-weight: 800; line-height: 1.25;">${heading}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 22px 18px 22px; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color: #111827; font-size: 16px; line-height: 1.6;">
                      ${options.bodyHtml}
                    </td>
                  </tr>
                </table>
                <div style="padding: 14px 8px 0 8px; text-align: center; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color: #6b7280; font-size: 12px; line-height: 1.5;">
                  ${footerHtml}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ========================
// Email Template Functions
// ========================

/**
 * Send schedule published notification to all staff
 */
export async function sendSchedulePublishedNotification(
  data: SchedulePublishedData
): Promise<void> {
  const { schedule, organization, staff, timezone = 'America/New_York' } = data
  const weekStart = formatWeekStart(schedule.weekStartDate, timezone)
  const subject = `[${organization.name}] Schedule Published for Week of ${weekStart}`

  const staffEmails = staff
    .filter(s => s.email)
    .map(s => s.email as string)

  if (staffEmails.length === 0) {
    console.log('[Email] No staff with email addresses to notify')
    return
  }

  const scheduleUrl = buildOrgUrl(organization.subdomain, '/schedule')
  const primaryColor = sanitizeBrandColor(organization.primaryColor, '#2563eb')
  const orgName = organization.name

  const htmlBody = renderTransactionalEmailHtml({
    brandName: orgName,
    brandColor: primaryColor,
    preheader: `A new schedule is available for the week of ${weekStart}.`,
    heading: 'Schedule published',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">A new schedule has been published for the week of <strong>${escapeHtml(weekStart)}</strong>.</p>
      <p style="margin: 0 0 18px 0;">Log in to view your assignments and session details.</p>
      ${renderEmailButton(scheduleUrl, 'View schedule', primaryColor)}
      ${renderEmailUrlFallback(scheduleUrl, primaryColor)}
    `,
    footerHtml: `<p style="margin: 0;">Sent by Say It Schedule for ${escapeHtml(orgName)}.</p><p style="margin: 8px 0 0 0;">Questions? Contact your administrator.</p>`
  })

  const textBody = `
${orgName} - Schedule Published

A new schedule has been published for the week of ${weekStart}.

Please log in to view your assignments and session details.

View Schedule: ${scheduleUrl}

---
Sent by Say It Schedule for ${orgName}.
Questions? Contact your administrator.
`

  // Send to each staff member individually for privacy
  for (const email of staffEmails) {
    await sendEmail(email, subject, htmlBody, textBody)
  }
}

/**
 * Send time-off request submitted notification to admins
 */
export async function sendTimeOffRequestSubmitted(
  data: TimeOffRequestData,
  adminEmails: string[]
): Promise<void> {
  const { availability, staff, organization, timezone = 'America/New_York' } = data
  const requestDate = formatDate(availability.date, timezone)
  const subject = `[${organization.name}] New Time-Off Request from ${staff.name}`

  if (adminEmails.length === 0) {
    console.log('[Email] No admin emails to notify')
    return
  }

  const pendingUrl = buildOrgUrl(organization.subdomain, '/availability/pending')
  const primaryColor = sanitizeBrandColor(organization.primaryColor, '#2563eb')
  const orgName = organization.name

  let timeInfo = 'Full Day'
  if (availability.startTime && availability.endTime) {
    timeInfo = `${availability.startTime} - ${availability.endTime}`
  }

  const htmlBody = renderTransactionalEmailHtml({
    brandName: orgName,
    brandColor: primaryColor,
    preheader: `New time-off request from ${staff.name} on ${requestDate}.`,
    heading: 'New time-off request',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">A new time-off request requires your review:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin: 0;">
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb; width: 150px;">Staff member</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;">${escapeHtml(staff.name)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Date</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;">${escapeHtml(requestDate)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;${availability.reason ? ' border-bottom: 1px solid #e5e7eb;' : ''}">Time</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827;${availability.reason ? ' border-bottom: 1px solid #e5e7eb;' : ''}">${escapeHtml(timeInfo)}</td>
        </tr>
        ${
          availability.reason
            ? `<tr><td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">Reason</td><td style="padding: 10px 12px; font-size: 13px; color: #111827;">${escapeHtml(availability.reason)}</td></tr>`
            : ''
        }
      </table>
      <div style="margin-top: 18px;">
        ${renderEmailButton(pendingUrl, 'Review request', primaryColor)}
      </div>
      ${renderEmailUrlFallback(pendingUrl, primaryColor)}
    `,
    footerHtml: `<p style="margin: 0;">Sent by Say It Schedule for ${escapeHtml(orgName)}.</p>`
  })

  const textBody = `
${orgName} - New Time-Off Request

A new time-off request has been submitted and requires your review.

Details:
- Staff Member: ${staff.name}
- Date: ${requestDate}
- Time: ${timeInfo}
${availability.reason ? `- Reason: ${availability.reason}` : ''}

Review Request: ${pendingUrl}

---
Sent by Say It Schedule for ${orgName}.
`

  // Send individually for privacy
  for (const email of adminEmails) {
    await sendEmail(email, subject, htmlBody, textBody)
  }
}

/**
 * Send time-off request approved/rejected notification to staff
 */
export async function sendTimeOffReviewed(
  data: TimeOffReviewedData
): Promise<void> {
  const { availability, staff, organization, approved, reviewerNotes, timezone = 'America/New_York' } = data

  if (!staff.email) {
    console.log('[Email] Staff member has no email address')
    return
  }

  const requestDate = formatDate(availability.date, timezone)
  const status = approved ? 'Approved' : 'Denied'
  const subject = `[${organization.name}] Time-Off Request ${status}`
  const primaryColor = sanitizeBrandColor(organization.primaryColor, '#2563eb')
  const orgName = organization.name

  let timeInfo = 'Full Day'
  if (availability.startTime && availability.endTime) {
    timeInfo = `${availability.startTime} - ${availability.endTime}`
  }

  const statusBg = approved ? '#ecfdf5' : '#fef2f2'
  const statusText = approved ? '#065f46' : '#991b1b'

  const htmlBody = renderTransactionalEmailHtml({
    brandName: orgName,
    brandColor: primaryColor,
    preheader: `Your time-off request for ${requestDate} was ${status.toLowerCase()}.`,
    heading: `Time-off request ${status.toLowerCase()}`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Your time-off request has been reviewed.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 14px 0;">
        <tr>
          <td style="padding: 6px 10px; border-radius: 999px; background-color: ${statusBg}; color: ${statusText}; font-size: 13px; font-weight: 700;">
            Status: ${escapeHtml(status)}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin: 0;">
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb; width: 150px;">Date</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;">${escapeHtml(requestDate)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;${availability.reason ? ' border-bottom: 1px solid #e5e7eb;' : ''}">Time</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827;${availability.reason ? ' border-bottom: 1px solid #e5e7eb;' : ''}">${escapeHtml(timeInfo)}</td>
        </tr>
        ${
          availability.reason
            ? `<tr><td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">Reason</td><td style="padding: 10px 12px; font-size: 13px; color: #111827;">${escapeHtml(availability.reason)}</td></tr>`
            : ''
        }
      </table>
      ${
        reviewerNotes
          ? `<div style="margin: 14px 0 0 0; padding: 12px 14px; border-radius: 10px; background-color: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 13px; line-height: 1.5;">
              <strong>Reviewer notes:</strong><br>${escapeHtml(reviewerNotes)}
            </div>`
          : ''
      }
    `,
    footerHtml: `<p style="margin: 0;">Sent by Say It Schedule for ${escapeHtml(orgName)}.</p><p style="margin: 8px 0 0 0;">Questions? Contact your administrator.</p>`
  })

  const textBody = `
${organization.name} - Time-Off Request ${status}

Your time-off request has been reviewed.

Details:
- Date: ${requestDate}
- Time: ${timeInfo}
${availability.reason ? `- Reason: ${availability.reason}` : ''}
- Status: ${status}
${reviewerNotes ? `\nReviewer Notes: ${reviewerNotes}` : ''}

---
Sent by Say It Schedule for ${organization.name}.
Questions? Contact your administrator.
`

  await sendEmail(staff.email, subject, htmlBody, textBody)
}

/**
 * Send user invitation email with password setup link
 */
export async function sendUserInvitation(
  data: UserInvitationData
): Promise<boolean> {
  const { user, organization, token, invitedByName } = data

  const orgName = organization?.name || 'Say It Schedule'
  const primaryColor = sanitizeBrandColor(organization?.primaryColor, '#2563eb')

  // Build the setup password URL with organization's subdomain
  const setupUrl = buildOrgUrl(organization?.subdomain, `/setup-password?token=${token}`)

  const subject = `You're invited to ${orgName}`

  const htmlBody = renderTransactionalEmailHtml({
    brandName: orgName,
    brandColor: primaryColor,
    preheader: `Set up your password to join ${orgName}. Link expires in 48 hours.`,
    heading: `You're invited`,
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${escapeHtml(user.name)},</p>
      <p style="margin: 0 0 12px 0;">${escapeHtml(invitedByName)} invited you to join <strong>${escapeHtml(orgName)}</strong> on Say It Schedule.</p>
      <p style="margin: 0 0 18px 0;">To get started, set up your password for <strong>${escapeHtml(user.email)}</strong>.</p>
      ${renderEmailButton(setupUrl, 'Set up your password', primaryColor)}
      ${renderEmailUrlFallback(setupUrl, primaryColor)}
      <p style="margin: 14px 0 0 0; font-size: 13px; color: #6b7280;">This link expires in 48 hours. If you weren’t expecting this invitation, you can ignore this email.</p>
    `,
    footerHtml: `<p style="margin: 0;">Sent by Say It Schedule for ${escapeHtml(orgName)}.</p><p style="margin: 8px 0 0 0;">Questions? Reply to this email or contact your administrator.</p>`
  })

  const textBody = `
You're invited to ${orgName}

Hi ${user.name},

${invitedByName} invited you to join ${orgName} on Say It Schedule. To get started, set up your password for ${user.email}.

Set up your password: ${setupUrl}

This link will expire in 48 hours. If you didn't expect this invitation, you can safely ignore this email.

---
Sent by Say It Schedule for ${orgName}.
Questions? Reply to this email or contact your administrator.
`

  return sendEmail(user.email, subject, htmlBody, textBody)
}

/**
 * Send super admin invitation email with password setup link
 * Super admins don't belong to an organization, so they use the main app URL
 */
export async function sendSuperAdminInvitation(
  data: SuperAdminInvitationData
): Promise<boolean> {
  const { user, token, invitedByName } = data

  const primaryColor = '#0f172a' // Dark slate for super admin branding

  // Super admins use the main app URL (no subdomain)
  const setupUrl = `${APP_URL}/setup-password?token=${token}`

  const subject = `You've been invited to Say It Schedule as a Super Admin`

  const htmlBody = renderTransactionalEmailHtml({
    brandName: 'Say It Schedule',
    brandColor: primaryColor,
    preheader: 'Set up your password to activate super admin access. Link expires in 48 hours.',
    heading: 'Super admin invitation',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${escapeHtml(user.name)},</p>
      <p style="margin: 0 0 12px 0;">${escapeHtml(invitedByName)} invited you to join Say It Schedule as a <strong>Super Administrator</strong>.</p>
      <p style="margin: 0 0 18px 0;">This role grants platform-wide access to manage organizations, users, and system settings.</p>
      ${renderEmailButton(setupUrl, 'Set up your password', primaryColor)}
      ${renderEmailUrlFallback(setupUrl, primaryColor)}
      <div style="margin: 16px 0 0 0; padding: 12px 14px; border-radius: 10px; background-color: #eef2ff; border: 1px solid #e0e7ff; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
        <strong>Security note:</strong> After setting your password, you’ll be required to set up two-factor authentication (2FA).
      </div>
      <p style="margin: 14px 0 0 0; font-size: 13px; color: #6b7280;">This link expires in 48 hours. If you weren’t expecting this invitation, you can ignore this email.</p>
    `,
    footerHtml:
      '<p style="margin: 0;">Sent by Say It Schedule.</p><p style="margin: 8px 0 0 0;">Questions? Reply to this email.</p>'
  })

  const textBody = `
Welcome to Say It Schedule!

${invitedByName} has invited you to join Say It Schedule as a Super Administrator. This role grants you platform-wide access to manage organizations, users, and system settings.

Hi ${user.name},

Account: ${user.email}
Role: Super Administrator

Set Up Your Password: ${setupUrl}

SECURITY NOTE: After setting your password, you will be required to set up two-factor authentication (2FA) to protect your super admin account.

This link will expire in 48 hours. If you didn't expect this invitation, you can safely ignore this email.

---
Sent by Say It Schedule.
Questions? Reply to this email.
`

  return sendEmail(user.email, subject, htmlBody, textBody)
}

/**
 * Send password reset email with reset link
 */
export async function sendPasswordResetEmail(
  data: PasswordResetData
): Promise<boolean> {
  const { user, organization, token } = data

  const orgName = organization?.name || 'Say It Schedule'
  const primaryColor = sanitizeBrandColor(organization?.primaryColor, '#2563eb')

  // Build the reset password URL with organization's subdomain
  const resetUrl = buildOrgUrl(organization?.subdomain, `/setup-password?token=${token}`)

  const subject = `Reset your ${orgName} password`

  const htmlBody = renderTransactionalEmailHtml({
    brandName: orgName,
    brandColor: primaryColor,
    preheader: `Reset your password for ${orgName}. Link expires in 1 hour.`,
    heading: 'Reset your password',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${escapeHtml(user.name)},</p>
      <p style="margin: 0 0 18px 0;">We received a request to reset the password for your <strong>${escapeHtml(orgName)}</strong> account.</p>
      ${renderEmailButton(resetUrl, 'Reset your password', primaryColor)}
      ${renderEmailUrlFallback(resetUrl, primaryColor)}
      <p style="margin: 14px 0 0 0; font-size: 13px; color: #6b7280;">This link expires in 1 hour for security reasons.</p>
      <div style="margin: 14px 0 0 0; padding: 12px 14px; border-radius: 10px; background-color: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 13px; line-height: 1.5;">
        <strong>Didn’t request this?</strong> You can ignore this email — your password will remain unchanged.
      </div>
    `,
    footerHtml: `<p style="margin: 0;">Sent by Say It Schedule for ${escapeHtml(orgName)}.</p><p style="margin: 8px 0 0 0;">Need help? Reply to this email or contact your administrator.</p>`
  })

  const textBody = `
Password Reset Request

Hi ${user.name},

We received a request to reset your password for your ${orgName} account.

Reset Your Password: ${resetUrl}

This link will expire in 1 hour for security reasons.

Didn't request this? If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
Sent by Say It Schedule for ${orgName}.
Need help? Reply to this email or contact your administrator.
`

  return sendEmail(user.email, subject, htmlBody, textBody)
}

/**
 * Send notification to sales team when a new lead is submitted
 */
export async function sendLeadNotification(
  lead: LeadNotificationData
): Promise<boolean> {
  const SALES_EMAIL = process.env.SALES_EMAIL || 'sales@sayitschedule.com'
  const subject = `New Lead: ${lead.name}${lead.company ? ` from ${lead.company}` : ''}`

  const createdAt = formatDate(lead.createdAt)
  const primaryColor = '#2563eb'

  const htmlBody = renderTransactionalEmailHtml({
    brandName: 'Say It Schedule',
    brandColor: primaryColor,
    preheader: `New lead: ${lead.name}${lead.company ? ` (${lead.company})` : ''}`,
    heading: 'New lead',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">A new lead was submitted from the landing page.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin: 0;">
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb; width: 150px;">Name</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;">${escapeHtml(lead.name)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Email</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;">
            <a href="mailto:${escapeHtml(lead.email)}" style="color: ${primaryColor}; text-decoration: none;">${escapeHtml(lead.email)}</a>
          </td>
        </tr>
        ${
          lead.company
            ? `<tr><td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Company</td><td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;">${escapeHtml(lead.company)}</td></tr>`
            : ''
        }
        ${
          lead.phone
            ? `<tr><td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Phone</td><td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;"><a href="tel:${escapeHtml(lead.phone)}" style="color: ${primaryColor}; text-decoration: none;">${escapeHtml(lead.phone)}</a></td></tr>`
            : ''
        }
        ${
          lead.role
            ? `<tr><td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Role</td><td style="padding: 10px 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb;">${escapeHtml(lead.role)}</td></tr>`
            : ''
        }
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">Submitted</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #111827;">${escapeHtml(createdAt)}</td>
        </tr>
      </table>
      ${
        lead.message
          ? `<div style="margin: 14px 0 0 0; padding: 12px 14px; border-radius: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; color: #111827; font-size: 13px; line-height: 1.5;">
              <strong>Message:</strong><br>${escapeHtml(lead.message)}
            </div>`
          : ''
      }
    `,
    footerHtml: `<p style="margin: 0;">Lead ID: ${escapeHtml(lead.id)}</p>`
  })

  const textBody = `
New Lead Received

A new lead has been submitted from the landing page.

Details:
- Name: ${lead.name}
- Email: ${lead.email}
${lead.company ? `- Company: ${lead.company}` : ''}
${lead.phone ? `- Phone: ${lead.phone}` : ''}
${lead.role ? `- Role: ${lead.role}` : ''}
- Submitted: ${createdAt}
${lead.message ? `\nMessage:\n${lead.message}` : ''}

---
This lead was captured from Say It Schedule landing page.
Lead ID: ${lead.id}
`

  return sendEmail(SALES_EMAIL, subject, htmlBody, textBody)
}

export const emailService = {
  sendSchedulePublishedNotification,
  sendTimeOffRequestSubmitted,
  sendTimeOffReviewed,
  sendUserInvitation,
  sendPasswordResetEmail,
  sendLeadNotification,
  sendEmail
}
