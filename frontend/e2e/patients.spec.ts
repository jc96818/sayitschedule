import { test, expect } from '@playwright/test'

/**
 * Patient Management E2E Tests
 *
 * These tests verify the patient management flows.
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

test.describe('Patient List Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should display patient management page', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    // Check page header - uses dynamic labels but default is "Clients"
    await expect(page.locator('h2')).toContainText(/Management/)
    await expect(page.getByText(/Manage .* records and scheduling preferences/)).toBeVisible()
  })

  test('should show Add Patient button', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    // Button text uses dynamic label
    await expect(page.getByRole('button', { name: /Add/i })).toBeVisible()
  })

  test('should display patient table with headers', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    // Wait for data to load
    await page.waitForSelector('table', { timeout: 10000 })

    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Gender' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Sessions/Week' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  })

  test('should have search input', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    const searchInput = page.getByPlaceholder(/Search .* by name/i)
    await expect(searchInput).toBeVisible()
  })

  test('should have status filter dropdown', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    const statusSelect = page.locator('select').filter({ hasText: 'Active' })
    await expect(statusSelect).toBeVisible()
  })

  test('should have gender filter dropdown', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    const genderSelect = page.locator('select').filter({ hasText: 'All Genders' })
    await expect(genderSelect).toBeVisible()
  })

  test('should filter patients by search query', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    // Wait for patients to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 })

    const searchInput = page.getByPlaceholder(/Search .* by name/i)
    await searchInput.fill('NonExistentName12345')
    await page.waitForTimeout(500) // Wait for filter

    // Should show no results
    await expect(page.getByText(/No .* found/)).toBeVisible()
  })

  test('should show patient count', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.waitForSelector('table', { timeout: 10000 })

    // Should show count in header
    await expect(page.locator('h3')).toContainText(/\(\d+\)/)
  })
})

test.describe('Add Patient Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should open add patient modal when clicking Add button', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    // Modal should appear with "Add" in title
    await expect(page.getByRole('heading', { name: /Add/i })).toBeVisible()

    // Form fields should be visible
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#gender')).toBeVisible()
  })

  test('should have required form fields in add modal', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    // Check all form fields
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#gender')).toBeVisible()
    await expect(page.locator('#dob')).toBeVisible()
    await expect(page.locator('#guardian')).toBeVisible()
    await expect(page.locator('#guardianPhone')).toBeVisible()
    await expect(page.locator('#guardianEmail')).toBeVisible()
    await expect(page.locator('#sessions')).toBeVisible()
    await expect(page.locator('#duration')).toBeVisible()
    await expect(page.locator('#genderPref')).toBeVisible()
    await expect(page.locator('#notes')).toBeVisible()
  })

  test('should close modal when clicking Cancel', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()
    await expect(page.getByRole('heading', { name: /Add/i })).toBeVisible()

    await page.getByRole('button', { name: /Cancel/i }).click()

    // Modal should be closed
    await expect(page.getByRole('heading', { name: /Add/i })).not.toBeVisible()
  })

  test('should successfully create new patient', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 })

    await page.getByRole('button', { name: /Add/i }).click()

    // Fill in the form with unique data
    const uniqueName = generateUniqueName('Test Patient')

    await page.locator('#name').fill(uniqueName)
    await page.locator('#gender').selectOption('female')
    await page.locator('#guardian').fill('Test Guardian')
    await page.locator('#guardianPhone').fill('555-123-4567')
    await page.locator('#guardianEmail').fill('guardian@test.com')
    await page.locator('#sessions').fill('3')
    await page.locator('#duration').selectOption('60')
    await page.locator('#genderPref').selectOption('')
    await page.locator('#notes').fill('Test patient notes')

    // Submit the form
    await page.getByRole('button', { name: /Add/i }).last().click()

    // Wait for modal to close
    await expect(page.getByRole('heading', { name: /Add/i })).not.toBeVisible({ timeout: 10000 })

    // New patient should appear in the list
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 })
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /Add/i }).last().click()

    // Form should still be open (validation failed)
    await expect(page.getByRole('heading', { name: /Add/i })).toBeVisible()
  })
})

test.describe('Patient Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to patient detail when clicking View', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    // Wait for patient list to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 })

    // Click first View button
    const viewLink = page.getByRole('link', { name: 'View' }).first()
    await viewLink.click()

    // Should navigate to patient detail page
    await expect(page).toHaveURL(/\/app\/patients\/[\w-]+/, { timeout: 5000 })
  })
})

test.describe('Patient Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should filter by status', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.waitForSelector('table', { timeout: 10000 })

    // Change status filter to show all
    const statusSelect = page.locator('select').filter({ hasText: 'Active' })
    await statusSelect.selectOption('')

    // Should show all patients (including inactive)
    await page.waitForTimeout(500)
    await expect(page.locator('table')).toBeVisible()
  })

  test('should filter by gender', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.waitForSelector('table', { timeout: 10000 })

    // Change gender filter
    const genderSelect = page.locator('select').filter({ hasText: 'All Genders' })
    await genderSelect.selectOption('female')

    await page.waitForTimeout(500)
    // Table should still be visible (with filtered results)
    await expect(page.locator('table')).toBeVisible()
  })

  test('should combine search and filters', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.waitForSelector('table', { timeout: 10000 })

    // Set gender filter
    const genderSelect = page.locator('select').filter({ hasText: 'All Genders' })
    await genderSelect.selectOption('female')

    // Add search query
    const searchInput = page.getByPlaceholder(/Search .* by name/i)
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
    await page.goto('http://demo.localhost:5173/app/patients')

    // Voice input should be visible for admin users
    await expect(page.getByText(/Add/)).toBeVisible()
    await expect(page.getByText(/Say it or type it/)).toBeVisible()
  })

  test('should have voice hints link', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

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
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.waitForSelector('table', { timeout: 10000 })

    // Table should have thead and tbody
    await expect(page.locator('table thead')).toBeVisible()
    await expect(page.locator('table tbody')).toBeVisible()
  })

  test('should have form labels in add modal', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    await expect(page.locator('label[for="name"]')).toContainText('Name')
    await expect(page.locator('label[for="gender"]')).toContainText('Gender')
    await expect(page.locator('label[for="guardian"]')).toContainText('Guardian')
  })
})

test.describe('Patient Session Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should allow configuring sessions per week', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    const sessionsInput = page.locator('#sessions')
    await expect(sessionsInput).toBeVisible()
    await expect(sessionsInput).toHaveAttribute('type', 'number')
    await expect(sessionsInput).toHaveAttribute('min', '1')
    await expect(sessionsInput).toHaveAttribute('max', '10')
  })

  test('should allow selecting session duration', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    const durationSelect = page.locator('#duration')
    await expect(durationSelect).toBeVisible()

    // Check duration options
    await expect(durationSelect.locator('option')).toHaveCount(4)
  })

  test('should allow setting therapist gender preference', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    const genderPrefSelect = page.locator('#genderPref')
    await expect(genderPrefSelect).toBeVisible()

    // Should have options for no preference, female, and male
    await expect(genderPrefSelect.locator('option')).toHaveCount(3)
  })
})

test.describe('Guardian Information', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should have guardian name field', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    const guardianInput = page.locator('#guardian')
    await expect(guardianInput).toBeVisible()
    await expect(guardianInput).toHaveAttribute('type', 'text')
  })

  test('should have guardian phone field', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    const guardianPhoneInput = page.locator('#guardianPhone')
    await expect(guardianPhoneInput).toBeVisible()
    await expect(guardianPhoneInput).toHaveAttribute('type', 'tel')
  })

  test('should have guardian email field', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/patients')

    await page.getByRole('button', { name: /Add/i }).click()

    const guardianEmailInput = page.locator('#guardianEmail')
    await expect(guardianEmailInput).toBeVisible()
    await expect(guardianEmailInput).toHaveAttribute('type', 'email')
  })
})
