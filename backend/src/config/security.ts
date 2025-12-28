export function getBcryptCost(): number {
  const raw = process.env.BCRYPT_COST
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 4 && parsed <= 20) return parsed
  }

  const env = process.env.NODE_ENV
  if (env === 'test') return 4
  if (env === 'production') return 12
  return 10
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || (process.env.NODE_ENV === 'production' ? '7d' : '1d')
}

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function getAuthRateLimitWindowMs(): number {
  return parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) ?? 60_000
}

export function getAuthLoginMaxPerIp(): number {
  return parsePositiveInt(process.env.AUTH_LOGIN_MAX_PER_IP) ?? 20
}

export function getAuthLoginMaxPerIpEmail(): number {
  return parsePositiveInt(process.env.AUTH_LOGIN_MAX_PER_IP_EMAIL) ?? 5
}

export function getAuthVerifyMfaMaxPerIp(): number {
  return parsePositiveInt(process.env.AUTH_VERIFY_MFA_MAX_PER_IP) ?? 30
}
