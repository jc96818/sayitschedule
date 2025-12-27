import { watch, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * Converts a hex color to HSL components
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Parse hex
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

/**
 * Converts HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0,
    g = 0,
    b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Generates color variants from a base color
 */
function generateColorVariants(baseColor: string) {
  const hsl = hexToHsl(baseColor)

  return {
    base: baseColor,
    hover: hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 10, 0)), // Darker for hover
    light: hslToHex(hsl.h, Math.min(hsl.s, 30), 95), // Very light background
    dark: hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 20, 0)) // Even darker
  }
}

/**
 * Applies organization branding colors to CSS custom properties
 */
export function applyBranding(primaryColor: string, secondaryColor?: string) {
  const root = document.documentElement
  const primary = generateColorVariants(primaryColor)
  const secondary = secondaryColor ? generateColorVariants(secondaryColor) : null

  // Apply primary color variants
  root.style.setProperty('--primary-color', primary.base)
  root.style.setProperty('--primary-hover', primary.hover)
  root.style.setProperty('--primary-light', primary.light)
  root.style.setProperty('--primary-dark', primary.dark)

  // Apply secondary color if provided
  if (secondary) {
    root.style.setProperty('--secondary-color', secondary.base)
  }
}

/**
 * Resets branding to default colors
 */
export function resetBranding() {
  const root = document.documentElement
  root.style.setProperty('--primary-color', '#2563eb')
  root.style.setProperty('--primary-hover', '#1d4ed8')
  root.style.setProperty('--primary-light', '#dbeafe')
  root.style.setProperty('--primary-dark', '#1e40af')
  root.style.setProperty('--secondary-color', '#64748b')
}

/**
 * Composable that watches the auth store and applies branding automatically
 */
export function useBranding() {
  const authStore = useAuthStore()

  const organization = computed(() => authStore.organization)

  // Watch for organization changes and apply branding
  watch(
    organization,
    (org) => {
      if (org?.primaryColor) {
        applyBranding(org.primaryColor, org.secondaryColor)
      } else {
        resetBranding()
      }
    },
    { immediate: true }
  )

  return {
    applyBranding,
    resetBranding
  }
}
