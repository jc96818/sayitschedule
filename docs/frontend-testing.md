# Frontend Testing Guide

This document covers the testing setup for the Say It Schedule frontend application, including how to run tests and guidelines for writing new tests.

## Overview

The frontend uses two testing frameworks:

- **Vitest** - Unit and component testing
- **Playwright** - End-to-end (E2E) testing

## Quick Start

```bash
cd frontend

# Run unit tests in watch mode
npm run test

# Run unit tests once
npm run test:run

# Run with coverage report
npm run test:coverage

# Run E2E tests (requires backend running)
npm run test:e2e

# Run E2E tests with interactive UI
npm run test:e2e:ui
```

## Unit & Component Testing (Vitest)

### Configuration

- Config file: `frontend/vitest.config.ts`
- Test setup: `frontend/src/test/setup.ts`
- Test pattern: `src/**/*.{test,spec}.ts`

### Directory Structure

```
frontend/src/
├── stores/
│   └── __tests__/
│       └── auth.test.ts       # Store tests
├── pages/
│   └── __tests__/
│       └── LoginPage.test.ts  # Page component tests
├── components/
│   └── __tests__/             # Component tests (create as needed)
└── test/
    └── setup.ts               # Global test setup
```

### Writing Store Tests

Store tests verify Pinia store logic in isolation with mocked API services.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'
import { authService } from '@/services/api'

// Mock API services
vi.mock('@/services/api', () => ({
  authService: {
    login: vi.fn(),
    me: vi.fn()
  }
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should login successfully', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      token: 'jwt-token',
      user: { id: '1', email: 'test@example.com', role: 'admin' }
    })

    const store = useAuthStore()
    await store.login({ email: 'test@example.com', password: 'password' })

    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.email).toBe('test@example.com')
  })
})
```

### Writing Component Tests

Component tests use Vue Test Utils to mount and interact with components.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import MyComponent from '../MyComponent.vue'

describe('MyComponent', () => {
  let router

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: MyComponent }]
    })
  })

  const mountComponent = async () => {
    const wrapper = mount(MyComponent, {
      global: {
        plugins: [router]
      }
    })
    await router.isReady()
    return wrapper
  }

  it('should render correctly', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('h1').text()).toBe('Expected Title')
  })

  it('should handle button click', async () => {
    const wrapper = await mountComponent()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
```

### Test Utilities

The setup file (`src/test/setup.ts`) provides:

- **localStorage mock** - Automatically cleared between tests
- **window.location mock** - For testing redirects
- **beforeEach cleanup** - Mocks reset automatically

### Common Patterns

#### Mocking API Responses

```typescript
vi.mocked(apiService.getData).mockResolvedValue({ data: [...] })
vi.mocked(apiService.getData).mockRejectedValue(new Error('Network error'))
```

#### Testing Async Operations

```typescript
import { flushPromises } from '@vue/test-utils'

await wrapper.find('form').trigger('submit')
await flushPromises() // Wait for all promises to resolve
expect(wrapper.find('.success-message').exists()).toBe(true)
```

#### Testing Form Inputs

```typescript
await wrapper.find('input#email').setValue('test@example.com')
await wrapper.find('select').setValue('option1')
await wrapper.find('input[type="checkbox"]').setValue(true)
```

#### Testing Emitted Events

```typescript
await wrapper.find('button').trigger('click')
expect(wrapper.emitted('update')).toHaveLength(1)
expect(wrapper.emitted('update')[0]).toEqual([expectedPayload])
```

## End-to-End Testing (Playwright)

### Configuration

- Config file: `frontend/playwright.config.ts`
- Test directory: `frontend/e2e/`
- Browsers: Chromium, Firefox, WebKit

### Prerequisites

E2E tests require the full application stack:

```bash
# Terminal 1: Start database
docker-compose up -d

# Terminal 2: Start backend
cd backend && npm run dev

# Terminal 3: Run E2E tests
cd frontend && npm run test:e2e
```

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('should do something', async ({ page }) => {
    // Fill form
    await page.locator('input#email').fill('user@example.com')
    await page.locator('input#password').fill('password')
    await page.locator('button[type="submit"]').click()

    // Assert navigation
    await expect(page).toHaveURL(/\/dashboard/)

    // Assert content
    await expect(page.locator('h1')).toContainText('Welcome')
  })
})
```

### Common Playwright Patterns

#### Waiting for Elements

```typescript
await expect(page.locator('.loading')).toBeHidden()
await expect(page.locator('.data-table')).toBeVisible()
```

#### Handling Navigation

```typescript
await page.locator('a[href="/settings"]').click()
await expect(page).toHaveURL(/\/settings/)
```

#### Testing Multi-Tenant Subdomains

```typescript
// Access organization-specific subdomain
await page.goto('http://demo.localhost:5173/login')
```

#### Taking Screenshots on Failure

Screenshots are automatically captured on test failure. To take manual screenshots:

```typescript
await page.screenshot({ path: 'debug-screenshot.png' })
```

### Test Accounts

Use these accounts for E2E testing (from CLAUDE.md):

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@sayitschedule.com | sayitadmin2025 |
| Admin | admin@demo.sayitschedule.com | sayitadmin2025 |
| Assistant | assistant@demo.sayitschedule.com | sayitadmin2025 |

## Best Practices

### General Guidelines

1. **Test behavior, not implementation** - Focus on what the component does, not how it does it
2. **Use descriptive test names** - Test names should describe the expected behavior
3. **One assertion per concept** - Each test should verify one specific behavior
4. **Avoid testing library internals** - Don't test Vue/Pinia/Router behavior

### Unit Tests

1. **Mock external dependencies** - API calls, router, external libraries
2. **Test edge cases** - Empty states, error states, loading states
3. **Keep tests isolated** - Each test should be independent

### Component Tests

1. **Test user interactions** - Clicks, form inputs, keyboard navigation
2. **Test conditional rendering** - v-if, v-show, dynamic content
3. **Test props and emits** - Component interface contract

### E2E Tests

1. **Test critical user flows** - Login, core features, checkout
2. **Use realistic data** - Test with production-like scenarios
3. **Handle flakiness** - Use proper waits, avoid timing-based assertions
4. **Keep tests independent** - Don't rely on test execution order

## Debugging Tests

### Vitest

```bash
# Run specific test file
npm run test -- src/stores/__tests__/auth.test.ts

# Run tests matching pattern
npm run test -- -t "should login"

# Run with verbose output
npm run test -- --reporter=verbose
```

### Playwright

```bash
# Run with headed browser (visible)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- e2e/auth.spec.ts

# Debug mode (step through tests)
npm run test:e2e -- --debug

# Generate test from browser actions
npx playwright codegen localhost:5173
```

## Coverage Reports

Generate coverage reports with:

```bash
npm run test:coverage
```

Coverage report is generated in `frontend/coverage/`. Open `coverage/index.html` in a browser to view the detailed report.

## CI Integration

For CI environments, use:

```bash
# Unit tests
npm run test:run

# E2E tests (CI mode with retries)
CI=true npm run test:e2e
```

The Playwright config automatically adjusts for CI:
- Retries failed tests twice
- Runs tests sequentially (single worker)
- Fails on `test.only()` usage
