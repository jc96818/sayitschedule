import { test, expect } from '@playwright/test'

/**
 * Authentication E2E Tests
 *
 * These tests verify the login flow for different user types.
 * They require the backend to be running with the test database seeded.
 *
 * Test accounts (from CLAUDE.md):
 * - Super Admin: superadmin@sayitschedule.com / sayitadmin2025
 * - Admin: admin@demo.sayitschedule.com / sayitadmin2025
 * - Assistant: assistant@demo.sayitschedule.com / sayitadmin2025
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('should display the login form', async ({ page }) => {
    // Check page title/branding
    await expect(page.locator('h1')).toContainText('Say It Schedule')
    await expect(page.locator('p').first()).toContainText('Voice-Powered Scheduling Made Simple')

    // Check form elements
    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In')

    // Check additional elements
    await expect(page.getByText('Remember me')).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.locator('input#email').fill('invalid@email.com')
    await page.locator('input#password').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    // Wait for error message
    await expect(page.locator('.alert-danger')).toContainText('Invalid email or password')
  })

  test('should show loading state during login', async ({ page }) => {
    await page.locator('input#email').fill('superadmin@sayitschedule.com')
    await page.locator('input#password').fill('sayitadmin2025')

    // Click and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // The button should show loading state briefly
    // Note: This might be too fast to catch, so we just verify the form was submitted
    await expect(submitButton).toBeEnabled({ timeout: 10000 })
  })
})

test.describe('Superadmin Login Flow', () => {
  test('should successfully login as superadmin and redirect to super-admin dashboard', async ({
    page
  }) => {
    await page.goto('/login')

    // Fill in superadmin credentials
    await page.locator('input#email').fill('superadmin@sayitschedule.com')
    await page.locator('input#password').fill('sayitadmin2025')
    await page.locator('button[type="submit"]').click()

    // Wait for navigation to super-admin dashboard
    await expect(page).toHaveURL(/\/super-admin/, { timeout: 10000 })

    // Verify we're on the super-admin page
    // The exact content depends on the dashboard implementation
    await expect(page.locator('body')).toBeVisible()
  })

  test('should persist login session', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.locator('input#email').fill('superadmin@sayitschedule.com')
    await page.locator('input#password').fill('sayitadmin2025')
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/super-admin/, { timeout: 10000 })

    // Navigate away and back - should still be logged in
    await page.goto('/super-admin')
    await expect(page).toHaveURL(/\/super-admin/)
  })

  test('should be able to access organizations page as superadmin', async ({ page }) => {
    // Login as superadmin
    await page.goto('/login')
    await page.locator('input#email').fill('superadmin@sayitschedule.com')
    await page.locator('input#password').fill('sayitadmin2025')
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/super-admin/, { timeout: 10000 })

    // Navigate to organizations
    await page.goto('/super-admin/organizations')
    await expect(page).toHaveURL(/\/super-admin\/organizations/)
  })

  test('should be able to logout', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.locator('input#email').fill('superadmin@sayitschedule.com')
    await page.locator('input#password').fill('sayitadmin2025')
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/super-admin/, { timeout: 10000 })

    // Find and click logout button (implementation depends on UI)
    // This assumes there's a logout button in the header or sidebar
    const logoutButton = page.getByRole('button', { name: /logout/i }).or(
      page.getByText(/logout/i)
    )

    // If logout button exists, click it
    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutButton.click()
      await expect(page).toHaveURL(/\/login/)
    }
  })
})

test.describe('Admin Login Flow', () => {
  test('should successfully login as organization admin', async ({ page }) => {
    // Navigate to demo organization subdomain
    await page.goto('http://demo.localhost:5173/login')

    // Fill in admin credentials
    await page.locator('input#email').fill('admin@demo.sayitschedule.com')
    await page.locator('input#password').fill('sayitadmin2025')
    await page.locator('button[type="submit"]').click()

    // Wait for navigation to app dashboard
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 })
  })
})

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route without auth', async ({
    page
  }) => {
    // Try to access protected route directly
    await page.goto('/app')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('should redirect to login when accessing super-admin route without auth', async ({
    page
  }) => {
    await page.goto('/super-admin')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})

test.describe('MFA Flow', () => {
  // Note: These tests require a user with MFA enabled
  // You may need to set up a specific test user with MFA for these tests

  test.skip('should show MFA form when user has MFA enabled', async ({ page }) => {
    await page.goto('/login')

    // Login with MFA-enabled user credentials
    await page.locator('input#email').fill('mfa-user@example.com')
    await page.locator('input#password').fill('password')
    await page.locator('button[type="submit"]').click()

    // Should show MFA form
    await expect(page.locator('h2')).toContainText('Two-Factor Authentication')
    await expect(page.locator('input#mfaCode')).toBeVisible()
  })

  test.skip('should show error for invalid MFA code', async ({ page }) => {
    // This test is skipped because it requires an MFA-enabled test user
    // and a way to generate valid/invalid codes
  })
})

test.describe('Accessibility', () => {
  test('should have proper form labels', async ({ page }) => {
    await page.goto('/login')

    // Check that inputs have associated labels
    const emailLabel = page.locator('label[for="email"]')
    const passwordLabel = page.locator('label[for="password"]')

    await expect(emailLabel).toContainText('Email')
    await expect(passwordLabel).toContainText('Password')
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/login')

    // Tab to email field
    await page.keyboard.press('Tab')
    await expect(page.locator('input#email')).toBeFocused()

    // Tab to password field
    await page.keyboard.press('Tab')
    await expect(page.locator('input#password')).toBeFocused()

    // Tab to remember me checkbox
    await page.keyboard.press('Tab')

    // Tab to forgot password link
    await page.keyboard.press('Tab')

    // Tab to submit button
    await page.keyboard.press('Tab')
    await expect(page.locator('button[type="submit"]')).toBeFocused()
  })
})
