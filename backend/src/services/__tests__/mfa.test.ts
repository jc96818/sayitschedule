import { describe, it, expect, beforeAll } from 'vitest'
import { mfaService } from '../mfa.js'
import { authenticator } from 'otplib'

describe('MFA Service', () => {
  describe('generateSecret', () => {
    it('should generate a valid secret, QR code, and otpauth URL', async () => {
      const email = 'test@example.com'
      const result = await mfaService.generateSecret(email)

      expect(result.secret).toBeDefined()
      expect(result.secret.length).toBeGreaterThan(10)
      expect(result.qrCode).toMatch(/^data:image\/png;base64,/)
      expect(result.otpauthUrl).toContain('otpauth://totp/')
      expect(result.otpauthUrl).toContain(encodeURIComponent(email))
      expect(result.otpauthUrl).toContain('Say%20It%20Schedule')
    })

    it('should generate unique secrets for each call', async () => {
      const result1 = await mfaService.generateSecret('user1@example.com')
      const result2 = await mfaService.generateSecret('user2@example.com')

      expect(result1.secret).not.toBe(result2.secret)
    })
  })

  describe('verifyToken', () => {
    it('should verify a valid TOTP token', async () => {
      const { secret } = await mfaService.generateSecret('test@example.com')
      const validToken = authenticator.generate(secret)

      const isValid = mfaService.verifyToken(secret, validToken)
      expect(isValid).toBe(true)
    })

    it('should reject an invalid TOTP token', async () => {
      const { secret } = await mfaService.generateSecret('test@example.com')

      const isValid = mfaService.verifyToken(secret, '000000')
      expect(isValid).toBe(false)
    })

    it('should reject malformed tokens without throwing', () => {
      const isValid = mfaService.verifyToken('invalid-secret', 'not-a-number')
      expect(isValid).toBe(false)
    })
  })

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', () => {
      const codes = mfaService.generateBackupCodes()

      expect(codes).toHaveLength(10)
    })

    it('should generate codes in XXXX-XXXX format', () => {
      const codes = mfaService.generateBackupCodes()

      codes.forEach((code) => {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      })
    })

    it('should not include confusing characters (0, O, 1, I)', () => {
      const codes = mfaService.generateBackupCodes()
      const allCodes = codes.join('')

      expect(allCodes).not.toMatch(/[0OIl1]/)
    })

    it('should generate unique codes', () => {
      const codes = mfaService.generateBackupCodes()
      const uniqueCodes = new Set(codes)

      expect(uniqueCodes.size).toBe(10)
    })
  })

  describe('hashBackupCodes and verifyBackupCode', () => {
    let plainCodes: string[]
    let hashedCodes: string[]

    beforeAll(async () => {
      plainCodes = mfaService.generateBackupCodes()
      hashedCodes = await mfaService.hashBackupCodes(plainCodes)
    })

    it('should hash all backup codes', () => {
      expect(hashedCodes).toHaveLength(10)
      hashedCodes.forEach((hash) => {
        expect(hash).toMatch(/^\$2[aby]\$.+/) // bcrypt hash pattern
      })
    })

    it('should verify a valid backup code', async () => {
      const result = await mfaService.verifyBackupCode(hashedCodes, plainCodes[0])

      expect(result.valid).toBe(true)
      expect(result.remainingCodes).toHaveLength(9)
    })

    it('should verify a backup code without hyphen', async () => {
      const codeWithoutHyphen = plainCodes[1].replace('-', '')
      const result = await mfaService.verifyBackupCode(hashedCodes, codeWithoutHyphen)

      expect(result.valid).toBe(true)
    })

    it('should verify a backup code in lowercase', async () => {
      const lowercaseCode = plainCodes[2].toLowerCase()
      const result = await mfaService.verifyBackupCode(hashedCodes, lowercaseCode)

      expect(result.valid).toBe(true)
    })

    it('should reject an invalid backup code', async () => {
      const result = await mfaService.verifyBackupCode(hashedCodes, 'INVALID-CODE')

      expect(result.valid).toBe(false)
      expect(result.remainingCodes).toHaveLength(10)
    })

    it('should remove the used code from remaining codes', async () => {
      // Use fresh codes for this test
      const freshCodes = mfaService.generateBackupCodes()
      const freshHashes = await mfaService.hashBackupCodes(freshCodes)

      const result1 = await mfaService.verifyBackupCode(freshHashes, freshCodes[0])
      expect(result1.valid).toBe(true)
      expect(result1.remainingCodes).toHaveLength(9)

      // The same code should not work with remaining codes
      const result2 = await mfaService.verifyBackupCode(result1.remainingCodes, freshCodes[0])
      expect(result2.valid).toBe(false)

      // But another code should still work
      const result3 = await mfaService.verifyBackupCode(result1.remainingCodes, freshCodes[1])
      expect(result3.valid).toBe(true)
      expect(result3.remainingCodes).toHaveLength(8)
    })
  })

  describe('encryptSecret and decryptSecret', () => {
    it('should encrypt and decrypt a secret correctly', () => {
      const originalSecret = 'JBSWY3DPEHPK3PXP'

      const encrypted = mfaService.encryptSecret(originalSecret)
      const decrypted = mfaService.decryptSecret(encrypted)

      expect(decrypted).toBe(originalSecret)
    })

    it('should produce different ciphertexts for the same input (due to random IV)', () => {
      const secret = 'JBSWY3DPEHPK3PXP'

      const encrypted1 = mfaService.encryptSecret(secret)
      const encrypted2 = mfaService.encryptSecret(secret)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should produce ciphertext in expected format (iv:encrypted)', () => {
      const secret = 'JBSWY3DPEHPK3PXP'
      const encrypted = mfaService.encryptSecret(secret)

      const parts = encrypted.split(':')
      expect(parts).toHaveLength(2)
      expect(parts[0]).toHaveLength(32) // 16 bytes IV in hex
      expect(parts[1].length).toBeGreaterThan(0)
    })

    it('should handle special characters in the secret', () => {
      const secret = 'ABC123!@#$%^&*()_+'

      const encrypted = mfaService.encryptSecret(secret)
      const decrypted = mfaService.decryptSecret(encrypted)

      expect(decrypted).toBe(secret)
    })

    it('should handle longer secrets', () => {
      const secret = 'A'.repeat(100)

      const encrypted = mfaService.encryptSecret(secret)
      const decrypted = mfaService.decryptSecret(encrypted)

      expect(decrypted).toBe(secret)
    })
  })
})
