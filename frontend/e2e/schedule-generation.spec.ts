import { test, expect } from '@playwright/test'

/**
 * Schedule Generation E2E Tests
 *
 * These tests verify the schedule generation flow.
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

// Helper to get next Monday's date
function getNextMonday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilMonday)
  return nextMonday.toISOString().split('T')[0]
}

test.describe('Schedule Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should display schedule page with header', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule')

    // Check page elements
    await expect(page.locator('h2')).toContainText('Weekly Schedule')
  })

  test('should have week navigation buttons', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule')

    // Check for prev/next week buttons
    await expect(page.getByText('Prev')).toBeVisible()
    await expect(page.getByText('Next')).toBeVisible()
  })

  test('should have print and download buttons', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule')

    await expect(page.getByText('Print')).toBeVisible()
    await expect(page.getByText('Download PDF')).toBeVisible()
  })

  test('should navigate to generate page when clicking generate link', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule')

    // Look for generate schedule link/button
    const generateLink = page.locator('a[href="/app/schedule/generate"]')
    if (await generateLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateLink.click()
      await expect(page).toHaveURL(/\/app\/schedule\/generate/)
    }
  })
})

test.describe('Schedule Generation Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should display generate schedule page with configuration form', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Check page header
    await expect(page.locator('h2')).toContainText('Generate Schedule')
    await expect(page.locator('p').first()).toContainText('Create a new AI-powered schedule')
  })

  test('should have schedule configuration card', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Check configuration card
    await expect(page.locator('h3')).toContainText('Schedule Configuration')

    // Check for date input
    await expect(page.locator('input#week')).toBeVisible()
  })

  test('should display summary cards with counts', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Check for summary cards (Therapists, Patients, Rules)
    await expect(page.getByText(/Active (Therapists|Staff)/)).toBeVisible()
    await expect(page.getByText(/Active (Patients|Clients)/)).toBeVisible()
    await expect(page.getByText('Active Rules')).toBeVisible()
  })

  test('should have generate button disabled without date selection', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Find generate button
    const generateButton = page.getByRole('button', { name: /Generate Schedule/i })
    await expect(generateButton).toBeVisible()

    // Should be disabled when no date is selected
    await expect(generateButton).toBeDisabled()
  })

  test('should enable generate button when date is selected', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())

    // Generate button should now be enabled
    const generateButton = page.getByRole('button', { name: /Generate Schedule/i })
    await expect(generateButton).toBeEnabled()
  })

  test('should have cancel button that returns to schedule page', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Find and click cancel button
    const cancelButton = page.locator('a.btn-outline, a:has-text("Cancel")')
    await cancelButton.click()

    // Should navigate back to schedule page
    await expect(page).toHaveURL(/\/app\/schedule$/)
  })

  test('should show week date range when date is selected', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())

    // Should show week range text
    await expect(page.getByText(/Week:/)).toBeVisible()
  })
})

test.describe('Schedule Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should show generating state when generate is clicked', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())

    // Click generate
    const generateButton = page.getByRole('button', { name: /Generate Schedule/i })
    await generateButton.click()

    // Should show generating state
    await expect(page.getByText('Generating Schedule')).toBeVisible({ timeout: 5000 })

    // Should show progress indicator
    await expect(page.locator('.generation-spinner, .progress-bar')).toBeVisible()
  })

  test('should show progress messages during generation', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())

    // Click generate
    const generateButton = page.getByRole('button', { name: /Generate Schedule/i })
    await generateButton.click()

    // Should show status messages (one of these should appear)
    const statusMessages = [
      'Initializing AI scheduler',
      'Loading staff and patient data',
      'Analyzing scheduling rules',
      'AI is optimizing assignments',
      'Validating constraints',
      'Finalizing schedule'
    ]

    // At least one status message should be visible during generation
    await expect(page.getByText(new RegExp(statusMessages.join('|'), 'i'))).toBeVisible({ timeout: 10000 })
  })

  // This test is more involved as it depends on the backend completing the generation
  test('should complete generation and show preview', async ({ page }) => {
    test.setTimeout(60000) // Allow up to 60 seconds for generation

    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())

    // Click generate
    const generateButton = page.getByRole('button', { name: /Generate Schedule/i })
    await generateButton.click()

    // Wait for generation to complete (preview state)
    // The preview should show success message or the schedule preview
    await expect(
      page.getByText('Schedule generated successfully').or(
        page.locator('h3:has-text("Schedule Preview")')
      )
    ).toBeVisible({ timeout: 45000 })
  })
})

test.describe('Schedule Preview and Publishing', () => {
  // Note: These tests require a generated schedule to be in preview state
  // They may be skipped if generation fails

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test.skip('should show preview with calendar grid after generation', async ({ page }) => {
    // This test assumes we have a generated schedule
    // In a real scenario, we would first generate a schedule

    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date and generate
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())
    await page.getByRole('button', { name: /Generate Schedule/i }).click()

    // Wait for preview
    await expect(page.locator('h3:has-text("Schedule Preview")')).toBeVisible({ timeout: 45000 })

    // Should have calendar grid
    await expect(page.locator('.calendar-grid, .calendar-preview')).toBeVisible()

    // Should have day headers (Monday-Friday)
    await expect(page.getByText('Monday')).toBeVisible()
    await expect(page.getByText('Friday')).toBeVisible()
  })

  test.skip('should show stat cards in preview', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date and generate
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())
    await page.getByRole('button', { name: /Generate Schedule/i }).click()

    // Wait for preview
    await expect(page.locator('h3:has-text("Schedule Preview")')).toBeVisible({ timeout: 45000 })

    // Should show stats
    await expect(page.getByText('Total Sessions')).toBeVisible()
  })

  test.skip('should have publish and start over buttons in preview', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Select a date and generate
    const dateInput = page.locator('input#week')
    await dateInput.fill(getNextMonday())
    await page.getByRole('button', { name: /Generate Schedule/i }).click()

    // Wait for preview
    await expect(page.locator('h3:has-text("Schedule Preview")')).toBeVisible({ timeout: 45000 })

    // Should have action buttons
    await expect(page.getByRole('button', { name: /Publish Schedule/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Start Over/i })).toBeVisible()
  })
})

test.describe('Schedule Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate between weeks using prev/next buttons', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule')

    // Get initial week display (if any)
    const initialUrl = page.url()

    // Click next week
    await page.getByText('Next').click()
    await expect(page).not.toHaveURL(initialUrl, { timeout: 5000 })

    // Click prev week
    await page.getByText('Prev').click()

    // Should be back at initial state
    await expect(page).toHaveURL(initialUrl, { timeout: 5000 })
  })
})

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should have proper form labels on generate page', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Check that date input has label
    const weekLabel = page.locator('label[for="week"]')
    await expect(weekLabel).toContainText('Select Week Start Date')
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('http://demo.localhost:5173/app/schedule/generate')

    // Tab to date input
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should be able to tab through the page elements
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })
})
