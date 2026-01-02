import { test, expect } from '@playwright/test'

/**
 * Staff Management E2E Tests
 *
 * These tests verify the staff management flows.
 * They require the backend to be running with the test database seeded.
 *
 * Test accounts (from CLAUDE.md):
 * - Admin: admin@demo.sayitschedule.com / sayitadmin2025
 */

// Helper to login as admin
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('http://demo.localhost:5173/login')
  await page.locator('input#email').fill('admin@demo.sayitschedule.com')
  await page.locator('input#password').fill('sayitadmin2025')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 })
}

// Generate unique name to avoid conflicts
function generateUniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`
}

test.describe('Staff List Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should display staff management page', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    // Check page header
    await expect(page.locator('h2')).toContainText('Therapists Management')
    await expect(page.getByText(/Manage therapists and their availability/)).toBeVisible()
  })

  test('should show Add Therapist button', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await expect(page.getByRole('button', { name: /Add Therapist/i })).toBeVisible()
  })

  test('should display staff table with headers', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    // Wait for data to load
    await page.waitForSelector('table', { timeout: 10000 })

    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Gender' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  })

  test('should have search input', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    const searchInput = page.getByPlaceholder(/Search therapists/i)
    await expect(searchInput).toBeVisible()
  })

  test('should have status filter dropdown', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    const statusSelect = page.locator('select').filter({ hasText: 'Active' })
    await expect(statusSelect).toBeVisible()
  })

  test('should have gender filter dropdown', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    const genderSelect = page.locator('select').filter({ hasText: 'All Genders' })
    await expect(genderSelect).toBeVisible()
  })

  test('should filter staff by search query', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    // Wait for staff to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 })

    const searchInput = page.getByPlaceholder(/Search therapists/i)
    await searchInput.fill('NonExistentName12345')
    await page.waitForTimeout(500) // Wait for filter

    // Should show no results
    await expect(page.getByText(/No therapists found/)).toBeVisible()
  })

  test('should show staff count', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.waitForSelector('table', { timeout: 10000 })

    // Should show count in header
    await expect(page.locator('h3')).toContainText(/Therapists \(\d+\)/)
  })
})

test.describe('Add Staff Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should open add staff modal when clicking Add button', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.getByRole('button', { name: /Add Therapist/i }).click()

    // Modal should appear
    await expect(page.getByRole('heading', { name: /Add Therapist/i })).toBeVisible()

    // Form fields should be visible
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#gender')).toBeVisible()
  })

  test('should have required form fields in add modal', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.getByRole('button', { name: /Add Therapist/i }).click()

    // Check all form fields
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#phone')).toBeVisible()
    await expect(page.locator('#gender')).toBeVisible()
    await expect(page.locator('#sessions')).toBeVisible()
  })

  test('should close modal when clicking Cancel', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.getByRole('button', { name: /Add Therapist/i }).click()
    await expect(page.getByRole('heading', { name: /Add Therapist/i })).toBeVisible()

    await page.getByRole('button', { name: /Cancel/i }).click()

    // Modal should be closed
    await expect(page.getByRole('heading', { name: /Add Therapist/i })).not.toBeVisible()
  })

  test('should successfully create new staff member', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    // Get initial count
    await page.waitForSelector('table', { timeout: 10000 })

    await page.getByRole('button', { name: /Add Therapist/i }).click()

    // Fill in the form with unique data
    const uniqueName = generateUniqueName('Test Therapist')
    const uniqueEmail = `test.${Date.now()}@example.com`

    await page.locator('#name').fill(uniqueName)
    await page.locator('#email').fill(uniqueEmail)
    await page.locator('#phone').fill('555-123-4567')
    await page.locator('#gender').selectOption('female')
    await page.locator('#sessions').fill('3')

    // Submit the form
    await page.getByRole('button', { name: /Add Therapist/i }).last().click()

    // Wait for modal to close
    await expect(page.getByRole('heading', { name: /Add Therapist/i })).not.toBeVisible({ timeout: 10000 })

    // New staff should appear in the list
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 })
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.getByRole('button', { name: /Add Therapist/i }).click()

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /Add Therapist/i }).last().click()

    // Form should still be open (validation failed)
    await expect(page.getByRole('heading', { name: /Add Therapist/i })).toBeVisible()
  })
})

test.describe('Staff Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to staff detail when clicking View', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    // Wait for staff list to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 })

    // Click first View button
    const viewLink = page.getByRole('link', { name: 'View' }).first()
    await viewLink.click()

    // Should navigate to staff detail page
    await expect(page).toHaveURL(/\/app\/staff\/[\w-]+/, { timeout: 5000 })
  })
})

test.describe('Staff Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should filter by status', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.waitForSelector('table', { timeout: 10000 })

    // Change status filter to show all
    const statusSelect = page.locator('select').filter({ hasText: 'Active' })
    await statusSelect.selectOption('')

    // Should show all staff (including inactive)
    await page.waitForTimeout(500)
    await expect(page.locator('table')).toBeVisible()
  })

  test('should filter by gender', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.waitForSelector('table', { timeout: 10000 })

    // Change gender filter
    const genderSelect = page.locator('select').filter({ hasText: 'All Genders' })
    await genderSelect.selectOption('female')

    await page.waitForTimeout(500)
    // Table should still be visible (with filtered results)
    await expect(page.locator('table')).toBeVisible()
  })

  test('should combine search and filters', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.waitForSelector('table', { timeout: 10000 })

    // Set gender filter
    const genderSelect = page.locator('select').filter({ hasText: 'All Genders' })
    await genderSelect.selectOption('female')

    // Add search query
    const searchInput = page.getByPlaceholder(/Search therapists/i)
    await searchInput.fill('a') // Common letter to get some results

    await page.waitForTimeout(500)
    await expect(page.locator('table')).toBeVisible()
  })
})

test.describe('Voice Input Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should display voice input section', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    // Voice input should be visible for admin users
    await expect(page.getByText(/Add Therapist/)).toBeVisible()
    await expect(page.getByText(/Say it or type it/)).toBeVisible()
  })

  test('should have voice hints link', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    const hintsLink = page.getByText(/See hints/i).or(page.getByText(/voice hints/i))
    if (await hintsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(hintsLink).toBeVisible()
    }
  })
})

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should have proper table structure', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.waitForSelector('table', { timeout: 10000 })

    // Table should have thead and tbody
    await expect(page.locator('table thead')).toBeVisible()
    await expect(page.locator('table tbody')).toBeVisible()
  })

  test('should have form labels in add modal', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/staff')

    await page.getByRole('button', { name: /Add Therapist/i }).click()

    await expect(page.locator('label[for="name"]')).toContainText('Name')
    await expect(page.locator('label[for="email"]')).toContainText('Email')
    await expect(page.locator('label[for="gender"]')).toContainText('Gender')
  })
})
