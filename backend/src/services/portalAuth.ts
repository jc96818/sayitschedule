/**
 * Portal Authentication Service
 *
 * Handles magic link / OTP authentication for patient portal users.
 * Uses AWS SNS for SMS and can integrate with email providers.
 */

import { createHash, randomBytes } from 'crypto'
import { prisma } from '../repositories/base.js'
import type { PatientContact, Patient, Organization } from '@prisma/client'

// Contact with patient relation included (as returned by verifyToken)
type ContactWithPatient = PatientContact & {
  patient: Patient & { organization: Organization }
}
import { organizationFeaturesRepository } from '../repositories/organizationFeatures.js'

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TOKEN_EXPIRY_MINUTES = 15
const SESSION_EXPIRY_HOURS = 24
const OTP_LENGTH = 6

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthRequestResult {
  success: boolean
  message: string
  channel?: 'email' | 'sms'
  expiresAt?: Date
}

export interface VerifyResult {
  success: boolean
  message: string
  sessionToken?: string
  contact?: ContactWithPatient
  expiresAt?: Date
}

export interface PortalUser {
  contactId: string
  patientId: string
  organizationId: string
  name: string
  email?: string | null
  phone?: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Generate a numeric OTP for SMS
 */
function generateOTP(): string {
  const digits = '0123456789'
  let otp = ''
  const bytes = randomBytes(OTP_LENGTH)
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += digits[bytes[i] % 10]
  }
  return otp
}

/**
 * Hash a token using SHA-256
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class PortalAuthService {
  private snsClient: { send: (message: string, phone: string) => Promise<boolean> } | null = null

  constructor() {
    // Initialize SNS client if AWS credentials are available
    this.initializeSNS()
  }

  private async initializeSNS() {
    // Lazy load AWS SDK to avoid issues in environments without it
    if (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID) {
      try {
        // Dynamic import - AWS SDK is optional dependency
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snsModule = await import('@aws-sdk/client-sns' as any) as any
        const { SNSClient, PublishCommand } = snsModule
        const client = new SNSClient({ region: process.env.AWS_REGION })

        this.snsClient = {
          send: async (message: string, phone: string): Promise<boolean> => {
            try {
              await client.send(new PublishCommand({
                Message: message,
                PhoneNumber: phone
              }))
              return true
            } catch (error) {
              console.error('SNS send error:', error)
              return false
            }
          }
        }
      } catch (error) {
        console.warn('AWS SNS not available:', error)
      }
    }
  }

  /**
   * Request a login token (magic link or OTP)
   */
  async requestLogin(
    identifier: string,
    channel: 'email' | 'sms',
    ipAddress?: string,
    userAgent?: string,
    expectedOrganizationId?: string | null
  ): Promise<AuthRequestResult> {
    // Find the contact by email or phone
    const contact = await prisma.patientContact.findFirst({
      where: {
        canAccessPortal: true,
        ...(expectedOrganizationId ? { patient: { organizationId: expectedOrganizationId } } : {}),
        ...(channel === 'email'
          ? { email: { equals: identifier, mode: 'insensitive' } }
          : { phone: identifier }
        )
      },
      include: {
        patient: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!contact) {
      // Don't reveal whether the contact exists
      return {
        success: true,
        message: `If an account exists for this ${channel === 'email' ? 'email' : 'phone number'}, you will receive a login ${channel === 'email' ? 'link' : 'code'} shortly.`,
        channel
      }
    }

    // If portal is disabled for this organization, do not send a token.
    // Return a generic success message to avoid enumerating accounts.
    const portalEnabled = await organizationFeaturesRepository.isPatientPortalEnabled(
      contact.patient.organizationId
    )
    if (!portalEnabled) {
      return {
        success: true,
        message: `If an account exists for this ${channel === 'email' ? 'email' : 'phone number'}, you will receive a login ${channel === 'email' ? 'link' : 'code'} shortly.`,
        channel
      }
    }

    // Generate token (magic link for email, OTP for SMS)
    const token = channel === 'sms' ? generateOTP() : generateToken()
    const tokenHash = hashToken(token)

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + TOKEN_EXPIRY_MINUTES)

    // Invalidate any existing unused tokens for this contact
    await prisma.portalLoginToken.updateMany({
      where: {
        contactId: contact.id,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: {
        expiresAt: new Date() // Expire immediately
      }
    })

    // Create the new token
    await prisma.portalLoginToken.create({
      data: {
        contactId: contact.id,
        tokenHash,
        channel,
        expiresAt,
        ipAddress,
        userAgent
      }
    })

    // Send the token
    const sent = await this.sendToken(contact, token, channel)

    if (!sent) {
      return {
        success: false,
        message: `Failed to send ${channel === 'email' ? 'email' : 'SMS'}. Please try again later.`
      }
    }

    return {
      success: true,
      message: `If an account exists for this ${channel === 'email' ? 'email' : 'phone number'}, you will receive a login ${channel === 'email' ? 'link' : 'code'} shortly.`,
      channel,
      expiresAt
    }
  }

  /**
   * Verify a login token and create a session
   */
  async verifyToken(
    token: string,
    ipAddress?: string,
    userAgent?: string,
    expectedOrganizationId?: string | null
  ): Promise<VerifyResult> {
    const tokenHash = hashToken(token)

    // Find the token
    const loginToken = await prisma.portalLoginToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        ...(expectedOrganizationId
          ? { contact: { patient: { organizationId: expectedOrganizationId } } }
          : {}
        )
      },
      include: {
        contact: {
          include: {
            patient: {
              include: {
                organization: true
              }
            }
          }
        }
      }
    })

    if (!loginToken) {
      return {
        success: false,
        message: 'Invalid or expired code. Please request a new one.'
      }
    }

    // Enforce portal feature flag per organization.
    const portalEnabled = await organizationFeaturesRepository.isPatientPortalEnabled(
      loginToken.contact.patient.organizationId
    )
    if (!portalEnabled) {
      return {
        success: false,
        message: 'Patient portal is not enabled for this organization.'
      }
    }

    // Mark token as used
    await prisma.portalLoginToken.update({
      where: { id: loginToken.id },
      data: { usedAt: new Date() }
    })

    // Create session
    const sessionToken = generateToken()
    const sessionHash = hashToken(sessionToken)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS)

    await prisma.portalSession.create({
      data: {
        contactId: loginToken.contactId,
        tokenHash: sessionHash,
        expiresAt,
        lastActivityAt: new Date(),
        ipAddress,
        userAgent
      }
    })

    return {
      success: true,
      message: 'Login successful',
      sessionToken,
      contact: loginToken.contact,
      expiresAt
    }
  }

  /**
   * Validate a session token and return the user
   */
  async validateSession(sessionToken: string): Promise<PortalUser | null> {
    const tokenHash = hashToken(sessionToken)

    const session = await prisma.portalSession.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        revokedAt: null
      },
      include: {
        contact: {
          include: {
            patient: {
              include: {
                organization: true
              }
            }
          }
        }
      }
    })

    if (!session) {
      return null
    }

    // If contact was disabled after session creation, treat session as invalid.
    if (!session.contact.canAccessPortal) {
      return null
    }

    // Enforce portal feature flag per organization. If disabled, treat as invalid.
    const portalEnabled = await organizationFeaturesRepository.isPatientPortalEnabled(
      session.contact.patient.organizationId
    )
    if (!portalEnabled) {
      return null
    }

    // Update last activity
    await prisma.portalSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() }
    })

    return {
      contactId: session.contact.id,
      patientId: session.contact.patientId,
      organizationId: session.contact.patient.organizationId,
      name: session.contact.name,
      email: session.contact.email,
      phone: session.contact.phone
    }
  }

  /**
   * Validate a session token and enforce it belongs to the expected organization.
   * This prevents cross-subdomain (tenant confusion) token reuse.
   */
  async validateSessionForOrganization(
    sessionToken: string,
    expectedOrganizationId: string
  ): Promise<PortalUser | null> {
    const tokenHash = hashToken(sessionToken)

    const session = await prisma.portalSession.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        revokedAt: null,
        contact: { patient: { organizationId: expectedOrganizationId } }
      },
      include: {
        contact: {
          include: {
            patient: {
              include: {
                organization: true
              }
            }
          }
        }
      }
    })

    if (!session) {
      return null
    }

    // If contact was disabled after session creation, treat session as invalid.
    if (!session.contact.canAccessPortal) {
      return null
    }

    // Enforce portal feature flag per organization. If disabled, treat as invalid.
    const portalEnabled = await organizationFeaturesRepository.isPatientPortalEnabled(
      session.contact.patient.organizationId
    )
    if (!portalEnabled) {
      return null
    }

    // Update last activity
    await prisma.portalSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() }
    })

    return {
      contactId: session.contact.id,
      patientId: session.contact.patientId,
      organizationId: session.contact.patient.organizationId,
      name: session.contact.name,
      email: session.contact.email,
      phone: session.contact.phone
    }
  }

  /**
   * Logout / revoke a session
   */
  async logout(sessionToken: string): Promise<boolean> {
    const tokenHash = hashToken(sessionToken)

    const result = await prisma.portalSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })

    return result.count > 0
  }

  /**
   * Revoke all sessions for a contact
   */
  async revokeAllSessions(contactId: string): Promise<number> {
    const result = await prisma.portalSession.updateMany({
      where: {
        contactId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })

    return result.count
  }

  /**
   * Clean up expired tokens and sessions
   */
  async cleanup(): Promise<{ tokens: number; sessions: number }> {
    const [tokens, sessions] = await prisma.$transaction([
      prisma.portalLoginToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { usedAt: { not: null } }
          ]
        }
      }),
      prisma.portalSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { not: null } }
          ]
        }
      })
    ])

    return {
      tokens: tokens.count,
      sessions: sessions.count
    }
  }

  /**
   * Send the token via the appropriate channel
   */
  private async sendToken(
    contact: PatientContact & { patient: { organization: { name: string } } },
    token: string,
    channel: 'email' | 'sms'
  ): Promise<boolean> {
    const orgName = contact.patient.organization.name

    if (channel === 'sms') {
      return this.sendSMS(contact.phone!, token, orgName)
    } else {
      return this.sendEmail(contact.email!, token, orgName)
    }
  }

  /**
   * Send OTP via SMS using AWS SNS
   */
  private async sendSMS(phone: string, otp: string, orgName: string): Promise<boolean> {
    const message = `Your ${orgName} portal login code is: ${otp}. It expires in ${TOKEN_EXPIRY_MINUTES} minutes.`

    if (this.snsClient) {
      return this.snsClient.send(message, phone)
    }

    // Development fallback - log to console
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV SMS] To: ${phone}, Message: ${message}`)
      return true
    }

    console.error('SMS sending not configured')
    return false
  }

  /**
   * Send magic link via email
   * TODO: Integrate with email provider (SES, SendGrid, etc.)
   */
  private async sendEmail(email: string, token: string, orgName: string): Promise<boolean> {
    const portalUrl = process.env.PORTAL_URL || 'http://localhost:5173/portal'
    const magicLink = `${portalUrl}/verify?token=${token}`

    // Development fallback - log to console
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV EMAIL] To: ${email}`)
      console.log(`  Subject: Your ${orgName} portal login link`)
      console.log(`  Link: ${magicLink}`)
      return true
    }

    // TODO: Implement actual email sending
    // For now, we'll use AWS SES or similar
    console.warn('Email sending not implemented, token:', token.substring(0, 8) + '...')
    return false
  }
}

export const portalAuthService = new PortalAuthService()
