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
}

interface TimeOffRequestData {
  availability: StaffAvailability
  staff: Staff
  organization: Organization
}

interface TimeOffReviewedData {
  availability: StaffAvailability
  staff: Staff
  organization: Organization
  approved: boolean
  reviewerNotes?: string | null
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
 * Format a date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format a week start date for display
 */
function formatWeekStart(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
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
  const { schedule, organization, staff } = data
  const weekStart = formatWeekStart(schedule.weekStartDate)
  const subject = `[${organization.name}] Schedule Published for Week of ${weekStart}`

  const staffEmails = staff
    .filter(s => s.email)
    .map(s => s.email as string)

  if (staffEmails.length === 0) {
    console.log('[Email] No staff with email addresses to notify')
    return
  }

  const scheduleUrl = buildOrgUrl(organization.subdomain, '/schedule')

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${organization.primaryColor || '#2563eb'}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .button { display: inline-block; background-color: ${organization.primaryColor || '#2563eb'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${organization.name}</h1>
    </div>
    <div class="content">
      <h2>New Schedule Published</h2>
      <p>A new schedule has been published for the week of <strong>${weekStart}</strong>.</p>
      <p>Please log in to view your assignments and session details.</p>
      <a href="${scheduleUrl}" class="button">View Schedule</a>
    </div>
    <div class="footer">
      <p>This is an automated message from Say It Schedule.</p>
      <p>If you have questions about your schedule, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
`

  const textBody = `
${organization.name} - New Schedule Published

A new schedule has been published for the week of ${weekStart}.

Please log in to view your assignments and session details.

View Schedule: ${scheduleUrl}

---
This is an automated message from Say It Schedule.
If you have questions about your schedule, please contact your administrator.
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
  const { availability, staff, organization } = data
  const requestDate = formatDate(availability.date)
  const subject = `[${organization.name}] New Time-Off Request from ${staff.name}`

  if (adminEmails.length === 0) {
    console.log('[Email] No admin emails to notify')
    return
  }

  const pendingUrl = buildOrgUrl(organization.subdomain, '/availability/pending')

  let timeInfo = 'Full Day'
  if (availability.startTime && availability.endTime) {
    timeInfo = `${availability.startTime} - ${availability.endTime}`
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${organization.primaryColor || '#2563eb'}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .details { background-color: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #6b7280; }
    .button { display: inline-block; background-color: ${organization.primaryColor || '#2563eb'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${organization.name}</h1>
    </div>
    <div class="content">
      <h2>New Time-Off Request</h2>
      <p>A new time-off request has been submitted and requires your review.</p>
      <div class="details">
        <div class="detail-row">
          <span class="label">Staff Member:</span> ${escapeHtml(staff.name)}
        </div>
        <div class="detail-row">
          <span class="label">Date:</span> ${escapeHtml(requestDate)}
        </div>
        <div class="detail-row">
          <span class="label">Time:</span> ${escapeHtml(timeInfo)}
        </div>
        ${availability.reason ? `<div class="detail-row"><span class="label">Reason:</span> ${escapeHtml(availability.reason)}</div>` : ''}
      </div>
      <a href="${pendingUrl}" class="button">Review Request</a>
    </div>
    <div class="footer">
      <p>This is an automated message from Say It Schedule.</p>
    </div>
  </div>
</body>
</html>
`

  const textBody = `
${organization.name} - New Time-Off Request

A new time-off request has been submitted and requires your review.

Details:
- Staff Member: ${staff.name}
- Date: ${requestDate}
- Time: ${timeInfo}
${availability.reason ? `- Reason: ${availability.reason}` : ''}

Review Request: ${pendingUrl}

---
This is an automated message from Say It Schedule.
`

  await sendEmail(adminEmails, subject, htmlBody, textBody)
}

/**
 * Send time-off request approved/rejected notification to staff
 */
export async function sendTimeOffReviewed(
  data: TimeOffReviewedData
): Promise<void> {
  const { availability, staff, organization, approved, reviewerNotes } = data

  if (!staff.email) {
    console.log('[Email] Staff member has no email address')
    return
  }

  const requestDate = formatDate(availability.date)
  const status = approved ? 'Approved' : 'Denied'
  const subject = `[${organization.name}] Time-Off Request ${status}`

  let timeInfo = 'Full Day'
  if (availability.startTime && availability.endTime) {
    timeInfo = `${availability.startTime} - ${availability.endTime}`
  }

  const statusColor = approved ? '#10b981' : '#ef4444'
  const statusIcon = approved ? '✓' : '✗'

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${organization.primaryColor || '#2563eb'}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .status { font-size: 24px; font-weight: bold; color: ${statusColor}; text-align: center; padding: 20px; }
    .details { background-color: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #6b7280; }
    .notes { background-color: #fef3c7; padding: 12px; border-radius: 6px; margin-top: 16px; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${organization.name}</h1>
    </div>
    <div class="content">
      <div class="status">${statusIcon} Request ${status}</div>
      <p>Your time-off request has been reviewed.</p>
      <div class="details">
        <div class="detail-row">
          <span class="label">Date:</span> ${escapeHtml(requestDate)}
        </div>
        <div class="detail-row">
          <span class="label">Time:</span> ${escapeHtml(timeInfo)}
        </div>
        ${availability.reason ? `<div class="detail-row"><span class="label">Reason:</span> ${escapeHtml(availability.reason)}</div>` : ''}
      </div>
      ${reviewerNotes ? `<div class="notes"><strong>Reviewer Notes:</strong> ${escapeHtml(reviewerNotes)}</div>` : ''}
    </div>
    <div class="footer">
      <p>This is an automated message from Say It Schedule.</p>
      <p>If you have questions, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
`

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
This is an automated message from Say It Schedule.
If you have questions, please contact your administrator.
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
  const primaryColor = organization?.primaryColor || '#2563eb'

  // Build the setup password URL with organization's subdomain
  const setupUrl = buildOrgUrl(organization?.subdomain, `/setup-password?token=${token}`)

  const subject = `You've been invited to ${orgName}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${primaryColor}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .welcome { font-size: 18px; margin-bottom: 16px; }
    .details { background-color: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #6b7280; }
    .button { display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: bold; }
    .expiry { color: #6b7280; font-size: 14px; margin-top: 16px; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
    </div>
    <div class="content">
      <p class="welcome">Welcome to ${escapeHtml(orgName)}!</p>
      <p>${escapeHtml(invitedByName)} has invited you to join ${escapeHtml(orgName)}. To get started, please set up your password by clicking the button below.</p>
      <div class="details">
        <div class="detail-row">
          <span class="label">Your Email:</span> ${escapeHtml(user.email)}
        </div>
        <div class="detail-row">
          <span class="label">Your Name:</span> ${escapeHtml(user.name)}
        </div>
      </div>
      <div style="text-align: center;">
        <a href="${setupUrl}" class="button">Set Up Your Password</a>
      </div>
      <p class="expiry">This link will expire in 48 hours. If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from Say It Schedule.</p>
      <p>If you have questions, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
`

  const textBody = `
Welcome to ${orgName}!

${invitedByName} has invited you to join ${orgName}. To get started, please set up your password by visiting the link below.

Your Email: ${user.email}
Your Name: ${user.name}

Set Up Your Password: ${setupUrl}

This link will expire in 48 hours. If you didn't expect this invitation, you can safely ignore this email.

---
This is an automated message from Say It Schedule.
If you have questions, please contact your administrator.
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

  const primaryColor = '#1e293b'  // Dark slate for super admin branding

  // Super admins use the main app URL (no subdomain)
  const setupUrl = `${APP_URL}/setup-password?token=${token}`

  const subject = `You've been invited to Say It Schedule as a Super Admin`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: white; padding: 20px; text-align: center; }
    .badge { display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 4px; font-size: 12px; margin-top: 8px; }
    .content { padding: 20px; background-color: #f9fafb; }
    .welcome { font-size: 18px; margin-bottom: 16px; }
    .details { background-color: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #6b7280; }
    .button { display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: bold; }
    .expiry { color: #6b7280; font-size: 14px; margin-top: 16px; }
    .mfa-notice { background-color: #dbeafe; padding: 12px; border-radius: 6px; margin-top: 16px; font-size: 14px; color: #1e40af; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Say It Schedule</h1>
      <span class="badge">Super Admin Access</span>
    </div>
    <div class="content">
      <p class="welcome">Welcome to Say It Schedule!</p>
      <p>${escapeHtml(invitedByName)} has invited you to join Say It Schedule as a <strong>Super Administrator</strong>. This role grants you platform-wide access to manage organizations, users, and system settings.</p>
      <div class="details">
        <div class="detail-row">
          <span class="label">Your Email:</span> ${escapeHtml(user.email)}
        </div>
        <div class="detail-row">
          <span class="label">Your Name:</span> ${escapeHtml(user.name)}
        </div>
        <div class="detail-row">
          <span class="label">Role:</span> Super Administrator
        </div>
      </div>
      <div style="text-align: center;">
        <a href="${setupUrl}" class="button">Set Up Your Password</a>
      </div>
      <div class="mfa-notice">
        <strong>Security Note:</strong> After setting your password, you will be required to set up two-factor authentication (2FA) to protect your super admin account.
      </div>
      <p class="expiry">This link will expire in 48 hours. If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from Say It Schedule.</p>
      <p>If you have questions, please contact the platform administrator.</p>
    </div>
  </div>
</body>
</html>
`

  const textBody = `
Welcome to Say It Schedule!

${invitedByName} has invited you to join Say It Schedule as a Super Administrator. This role grants you platform-wide access to manage organizations, users, and system settings.

Your Email: ${user.email}
Your Name: ${user.name}
Role: Super Administrator

Set Up Your Password: ${setupUrl}

SECURITY NOTE: After setting your password, you will be required to set up two-factor authentication (2FA) to protect your super admin account.

This link will expire in 48 hours. If you didn't expect this invitation, you can safely ignore this email.

---
This is an automated message from Say It Schedule.
If you have questions, please contact the platform administrator.
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
  const primaryColor = organization?.primaryColor || '#2563eb'

  // Build the reset password URL with organization's subdomain
  const resetUrl = buildOrgUrl(organization?.subdomain, `/setup-password?token=${token}`)

  const subject = `Reset your ${orgName} password`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${primaryColor}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .details { background-color: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .button { display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: bold; }
    .expiry { color: #6b7280; font-size: 14px; margin-top: 16px; }
    .warning { background-color: #fef3c7; padding: 12px; border-radius: 6px; margin-top: 16px; font-size: 14px; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hi ${escapeHtml(user.name)},</p>
      <p>We received a request to reset your password for your ${escapeHtml(orgName)} account. Click the button below to create a new password.</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Your Password</a>
      </div>
      <p class="expiry">This link will expire in 1 hour for security reasons.</p>
      <div class="warning">
        <strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from Say It Schedule.</p>
      <p>If you need help, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
`

  const textBody = `
Password Reset Request

Hi ${user.name},

We received a request to reset your password for your ${orgName} account.

Reset Your Password: ${resetUrl}

This link will expire in 1 hour for security reasons.

Didn't request this? If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This is an automated message from Say It Schedule.
If you need help, please contact your administrator.
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

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .details { background-color: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #6b7280; display: inline-block; width: 100px; }
    .message-box { background-color: white; padding: 16px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #2563eb; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Lead Received</h1>
    </div>
    <div class="content">
      <p>A new lead has been submitted from the landing page.</p>
      <div class="details">
        <div class="detail-row">
          <span class="label">Name:</span> ${escapeHtml(lead.name)}
        </div>
        <div class="detail-row">
          <span class="label">Email:</span> <a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>
        </div>
        ${lead.company ? `<div class="detail-row"><span class="label">Company:</span> ${escapeHtml(lead.company)}</div>` : ''}
        ${lead.phone ? `<div class="detail-row"><span class="label">Phone:</span> <a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></div>` : ''}
        ${lead.role ? `<div class="detail-row"><span class="label">Role:</span> ${escapeHtml(lead.role)}</div>` : ''}
        <div class="detail-row">
          <span class="label">Submitted:</span> ${escapeHtml(createdAt)}
        </div>
      </div>
      ${lead.message ? `<div class="message-box"><strong>Message:</strong><br>${escapeHtml(lead.message)}</div>` : ''}
    </div>
    <div class="footer">
      <p>This lead was captured from Say It Schedule landing page.</p>
      <p>Lead ID: ${lead.id}</p>
    </div>
  </div>
</body>
</html>
`

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
