import { authenticator } from 'otplib'
import * as QRCode from 'qrcode'
import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'

// App name shown in authenticator apps
const APP_NAME = 'Say It Schedule'

// Encryption key for MFA secrets - should be 32 bytes for AES-256
const getEncryptionKey = (): Buffer => {
  const key = process.env.MFA_ENCRYPTION_KEY
  if (!key) {
    // In development, use a default key (NOT for production!)
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return crypto.scryptSync('dev-mfa-key', 'salt', 32)
    }
    throw new Error('MFA_ENCRYPTION_KEY environment variable is required')
  }
  // Derive a 32-byte key from the provided key
  return crypto.scryptSync(key, 'mfa-salt', 32)
}

/**
 * MFA Service - handles TOTP generation, verification, and backup codes
 */
export const mfaService = {
  /**
   * Generate a new TOTP secret and QR code for a user
   */
  async generateSecret(email: string): Promise<{
    secret: string
    qrCode: string
    otpauthUrl: string
  }> {
    // Generate a random secret
    const secret = authenticator.generateSecret()

    // Create the otpauth URL for the authenticator app
    const otpauthUrl = authenticator.keyuri(email, APP_NAME, secret)

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauthUrl)

    return {
      secret,
      qrCode,
      otpauthUrl
    }
  },

  /**
   * Verify a TOTP code against a secret
   */
  verifyToken(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret })
    } catch {
      return false
    }
  },

  /**
   * Generate backup codes (10 random 8-character alphanumeric codes)
   */
  generateBackupCodes(): string[] {
    const codes: string[] = []
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars (0, O, 1, I)

    for (let i = 0; i < 10; i++) {
      let code = ''
      for (let j = 0; j < 8; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      // Format as XXXX-XXXX for readability
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
    }

    return codes
  },

  /**
   * Hash backup codes for secure storage
   */
  async hashBackupCodes(codes: string[]): Promise<string[]> {
    const hashedCodes = await Promise.all(
      codes.map((code) => bcrypt.hash(code.replace('-', ''), 10))
    )
    return hashedCodes
  },

  /**
   * Verify a backup code and return remaining codes if valid
   * Backup codes are single-use, so we return the list without the used code
   */
  async verifyBackupCode(
    hashedCodes: string[],
    code: string
  ): Promise<{ valid: boolean; remainingCodes: string[] }> {
    const normalizedCode = code.replace('-', '').toUpperCase()

    for (let i = 0; i < hashedCodes.length; i++) {
      const isMatch = await bcrypt.compare(normalizedCode, hashedCodes[i])
      if (isMatch) {
        // Remove the used code
        const remainingCodes = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)]
        return { valid: true, remainingCodes }
      }
    }

    return { valid: false, remainingCodes: hashedCodes }
  },

  /**
   * Encrypt a secret for database storage
   */
  encryptSecret(secret: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(secret, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted
  },

  /**
   * Decrypt a secret from database storage
   */
  decryptSecret(encryptedSecret: string): string {
    const key = getEncryptionKey()
    const [ivHex, encrypted] = encryptedSecret.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}
