/**
 * Subdomain utilities for multi-tenant routing
 */

// Reserved subdomains that don't map to organizations
const RESERVED_SUBDOMAINS = ['www', 'admin', 'api', 'app']

/**
 * Get the base domain from environment or detect from current hostname
 * Returns 'sayitschedule.com' in production, handles localhost in dev
 */
export function getBaseDomain(): string {
  const envDomain = import.meta.env.VITE_BASE_DOMAIN
  if (envDomain) {
    return envDomain
  }

  const hostname = window.location.hostname

  // Development - return as-is with port
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${hostname}:${window.location.port || '5173'}`
  }

  // Production - extract base domain (last two parts)
  const parts = hostname.split('.')
  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }

  return hostname
}

/**
 * Extract subdomain from current hostname
 * Returns null for root domain, localhost, or reserved subdomains
 */
export function getSubdomain(): string | null {
  const hostname = window.location.hostname

  // Plain localhost with no subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null
  }

  // Handle *.localhost for local development (e.g., demo.localhost)
  if (hostname.endsWith('.localhost')) {
    const subdomain = hostname.replace('.localhost', '')
    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return null
    }
    return subdomain
  }

  const parts = hostname.split('.')

  // Root domain (e.g., sayitschedule.com) - no subdomain
  if (parts.length <= 2) {
    return null
  }

  const subdomain = parts[0]

  // Reserved subdomains are not org subdomains
  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return null
  }

  return subdomain
}

/**
 * Check if current hostname is the root domain (no subdomain)
 */
export function isRootDomain(): boolean {
  const hostname = window.location.hostname

  // Plain localhost is treated as root domain for login purposes
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true
  }

  // *.localhost means we have a subdomain
  if (hostname.endsWith('.localhost')) {
    return false
  }

  const parts = hostname.split('.')
  return parts.length <= 2
}

/**
 * Check if current hostname is the admin subdomain
 */
export function isAdminSubdomain(): boolean {
  const hostname = window.location.hostname

  // Handle admin.localhost for local development
  if (hostname === 'admin.localhost') {
    return true
  }

  const parts = hostname.split('.')
  return parts.length > 2 && parts[0] === 'admin'
}

/**
 * Build a full URL for a given subdomain
 * @param subdomain - The subdomain (e.g., 'projecthope' or 'admin')
 * @param path - The path to navigate to (default: '/')
 * @param includeToken - Optional auth token to include as query param
 */
export function buildSubdomainUrl(
  subdomain: string,
  path: string = '/',
  includeToken?: string
): string {
  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const port = window.location.port

  // Handle *.localhost for local development
  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    const portSuffix = port ? `:${port}` : ''
    let url = `${protocol}//${subdomain}.localhost${portSuffix}${path}`
    if (includeToken) {
      const separator = path.includes('?') ? '&' : '?'
      url += `${separator}auth_token=${encodeURIComponent(includeToken)}`
    }
    return url
  }

  // Production - build subdomain URL
  const baseDomain = getBaseDomain()
  let url = `${protocol}//${subdomain}.${baseDomain}${path}`

  if (includeToken) {
    const separator = path.includes('?') ? '&' : '?'
    url += `${separator}auth_token=${encodeURIComponent(includeToken)}`
  }

  return url
}

/**
 * Check if we need to redirect to a different subdomain after login
 * Returns the redirect URL if needed, null otherwise
 */
export function getPostLoginRedirectUrl(
  isSuperAdmin: boolean,
  orgSubdomain: string | null | undefined,
  token: string
): string | null {
  const currentSubdomain = getSubdomain()
  const hostname = window.location.hostname

  // Only skip redirects for plain localhost (no subdomain support)
  // *.localhost supports subdomains for local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null
  }

  if (isSuperAdmin) {
    // Superadmins should be on admin subdomain
    if (currentSubdomain !== 'admin') {
      return buildSubdomainUrl('admin', '/super-admin', token)
    }
  } else if (orgSubdomain) {
    // Regular users should be on their org subdomain
    if (currentSubdomain !== orgSubdomain) {
      return buildSubdomainUrl(orgSubdomain, '/', token)
    }
  }

  return null
}

/**
 * Extract and consume auth token from URL query params
 * Returns the token if found, removes it from URL, stores in localStorage
 */
export function consumeAuthTokenFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('auth_token')

  if (token) {
    // Store the token
    localStorage.setItem('token', token)

    // Remove token from URL without triggering navigation
    urlParams.delete('auth_token')
    const newSearch = urlParams.toString()
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '')
    window.history.replaceState({}, '', newUrl)

    return token
  }

  return null
}
