import { prisma } from './base.js'
import type { PasswordResetToken, TokenType } from '@prisma/client'
import crypto from 'crypto'

export type { PasswordResetToken, TokenType }

// Token expiration times in hours
const TOKEN_EXPIRATION = {
  invitation: 48,      // 48 hours for new user invitations
  password_reset: 1    // 1 hour for password resets
}

export class PasswordResetTokenRepository {
  /**
   * Generate a secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Calculate expiration date based on token type
   */
  private getExpirationDate(type: TokenType): Date {
    const hours = TOKEN_EXPIRATION[type]
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + hours)
    return expiresAt
  }

  /**
   * Create a new token for a user
   * Invalidates any existing tokens of the same type for the user
   */
  async create(userId: string, type: TokenType): Promise<PasswordResetToken> {
    // Invalidate any existing tokens of this type for the user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId,
        type,
        usedAt: null
      },
      data: {
        usedAt: new Date() // Mark as used to invalidate
      }
    })

    // Create new token
    const token = this.generateToken()
    const expiresAt = this.getExpirationDate(type)

    return prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        type,
        expiresAt
      }
    })
  }

  /**
   * Find a valid token (not expired, not used)
   */
  async findValidToken(token: string): Promise<PasswordResetToken | null> {
    return prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    })
  }

  /**
   * Find a valid token with user data
   */
  async findValidTokenWithUser(token: string): Promise<(PasswordResetToken & {
    user: {
      id: string
      email: string
      name: string
      organizationId: string | null
      organization: { name: string; subdomain: string } | null
    }
  }) | null> {
    return prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            organizationId: true,
            organization: {
              select: {
                name: true,
                subdomain: true
              }
            }
          }
        }
      }
    })
  }

  /**
   * Mark a token as used
   */
  async markAsUsed(id: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() }
    })
  }

  /**
   * Delete expired tokens (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } }
        ]
      }
    })
    return result.count
  }

  /**
   * Find all tokens for a user
   */
  async findByUserId(userId: string): Promise<PasswordResetToken[]> {
    return prisma.passwordResetToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  }
}

export const passwordResetTokenRepository = new PasswordResetTokenRepository()
