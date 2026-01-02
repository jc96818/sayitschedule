# Frontend Testing Plan

This document outlines the testing strategy and implementation order for the Say It Schedule frontend application.

## Testing Philosophy

Tests are prioritized based on:
1. **Business criticality** - Features that directly impact revenue or user trust
2. **Complexity** - Features with intricate logic prone to regression
3. **Usage frequency** - Most-used features get tested first
4. **Risk** - Areas where bugs would cause significant problems

### Test Expected Behavior, Not Current Implementation

**Important**: Tests should verify that code behaves *correctly*, not just that it behaves *as currently implemented*. This distinction is critical:

#### ❌ Wrong Approach: Testing Current Behavior

```typescript
// Bad: This just documents whatever the code does, even if it's wrong
it('should show coverage rate', async () => {
  const wrapper = await mountSchedulePage()
  // If the code has a bug showing 100% always, this test would pass!
  expect(wrapper.text()).toContain('100%')
})
```

#### ✅ Correct Approach: Testing Expected Behavior

```typescript
// Good: This tests what SHOULD happen based on business requirements
it('should calculate coverage rate based on scheduled vs required sessions', async () => {
  // Patient needs 3 sessions/week, we scheduled 2
  const patient = { sessionsPerWeek: 3, status: 'active' }
  const sessions = [{ patientId: patient.id }, { patientId: patient.id }]

  // Coverage should be 2/3 = 67%, not 100%
  expect(calculateCoverage(sessions, [patient])).toBe(67)
})
```

#### Guidelines for Writing Correct Tests

1. **Understand the requirement first** - Before writing a test, understand what the feature *should* do, not just what it currently does. Check:
   - Product requirements/specs
   - User stories or tickets
   - Common sense expectations (e.g., a "coverage rate" should actually calculate coverage)

2. **Question suspicious behavior** - If you see code that seems wrong, investigate:
   - Hardcoded values (e.g., `coverageRate: 100 // TODO`)
   - Missing calculations
   - Timezone issues with date handling
   - Edge cases not handled

3. **Fix bugs, don't test around them** - When you find incorrect behavior:
   - Fix the bug in the implementation
   - Write a test that verifies the correct behavior
   - Document what was wrong and why

4. **Test edge cases with intent** - Edge cases should test boundary conditions, not just "what happens":

   ```typescript
   // Bad: Just checking it doesn't crash
   it('should handle empty patients', async () => {
     expect(() => render()).not.toThrow()
   })

   // Good: Verifying correct behavior for edge case
   it('should show 0% coverage when no patients exist', async () => {
     const coverage = calculateCoverage([], [])
     expect(coverage).toBe(0) // Not 100%, not NaN, not undefined
   })
   ```

5. **Review code during test writing** - Testing is an opportunity to catch bugs:
   - Read the implementation as you write tests
   - Look for TODOs, FIXMEs, or placeholder values
   - Check date/time handling for timezone bugs
   - Verify calculations actually calculate

#### Bugs Found Through This Approach

During testing, we identified and fixed:

| Bug                     | Location           | Issue                                    | Fix                                          |
|-------------------------|--------------------|------------------------------------------|----------------------------------------------|
| Hardcoded coverage rate | `SchedulePage.vue` | Always showed 100%                       | Calculate actual scheduled/required ratio    |
| Timezone date shift     | `SchedulePage.vue` | `toISOString()` caused dates to shift    | Use local date components instead            |

---

## Test Categories

| Category | Framework | Purpose |
|----------|-----------|---------|
| Unit Tests | Vitest | Test individual functions, stores, utilities |
| Component Tests | Vitest + Vue Test Utils | Test Vue components in isolation |
| E2E Tests | Playwright | Test complete user flows |

---

## Implementation Phases

### Phase 1: Authentication & Core Infrastructure ✅ COMPLETE

Critical path - users can't do anything without authentication.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Auth Store - Login | Unit | ✅ Done | `stores/__tests__/auth.test.ts` |
| Auth Store - Logout | Unit | ✅ Done | `stores/__tests__/auth.test.ts` |
| Auth Store - MFA | Unit | ✅ Done | `stores/__tests__/auth.test.ts` |
| Auth Store - Role Checks | Unit | ✅ Done | `stores/__tests__/auth.test.ts` |
| LoginPage - Form | Component | ✅ Done | `pages/__tests__/LoginPage.test.ts` |
| LoginPage - Errors | Component | ✅ Done | `pages/__tests__/LoginPage.test.ts` |
| LoginPage - MFA Flow | Component | ✅ Done | `pages/__tests__/LoginPage.test.ts` |
| E2E - Superadmin Login | E2E | ✅ Done | `e2e/auth.spec.ts` |
| E2E - Admin Login | E2E | ✅ Done | `e2e/auth.spec.ts` |
| E2E - Protected Routes | E2E | ✅ Done | `e2e/auth.spec.ts` |

---

### Phase 2: Schedule Management (HIGH PRIORITY) - COMPONENT & E2E TESTS IN PROGRESS

Core business functionality - the primary purpose of the application.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Schedules Store - CRUD | Unit | ✅ Done | `stores/__tests__/schedules.test.ts` |
| Schedules Store - Generate | Unit | ✅ Done | `stores/__tests__/schedules.test.ts` |
| Schedules Store - Publish | Unit | ✅ Done | `stores/__tests__/schedules.test.ts` |
| Schedules Store - Voice Mod | Unit | ✅ Done | `stores/__tests__/schedules.test.ts` |
| SchedulePage | Component | ✅ Done | `pages/__tests__/SchedulePage.test.ts` |
| ScheduleViewPage - Views | Component | ⬜ Todo | `pages/__tests__/ScheduleViewPage.test.ts` |
| ScheduleViewPage - Edit Session | Component | ⬜ Todo | `pages/__tests__/ScheduleViewPage.test.ts` |
| E2E - Schedule Page | E2E | ✅ Done | `e2e/schedule-generation.spec.ts` |
| E2E - Generate Schedule | E2E | ✅ Done | `e2e/schedule-generation.spec.ts` |
| E2E - Schedule Navigation | E2E | ✅ Done | `e2e/schedule-generation.spec.ts` |
| E2E - Publish Schedule | E2E | ⬜ Todo | `e2e/schedule-generation.spec.ts` |

---

### Phase 3: Staff Management (HIGH PRIORITY) - COMPONENT TESTS COMPLETE

Essential for schedule generation - staff are required inputs.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Staff Store - CRUD | Unit | ✅ Done | `stores/__tests__/staff.test.ts` |
| Staff Store - Filtering | Unit | ✅ Done | `stores/__tests__/staff.test.ts` |
| StaffListPage | Component | ✅ Done | `pages/__tests__/StaffListPage.test.ts` |
| StaffFormPage - Create | Component | ⬜ Todo | `pages/__tests__/StaffFormPage.test.ts` |
| StaffFormPage - Edit | Component | ⬜ Todo | `pages/__tests__/StaffFormPage.test.ts` |
| E2E - Add Staff | E2E | ⬜ Todo | `e2e/staff.spec.ts` |
| E2E - Edit Staff | E2E | ⬜ Todo | `e2e/staff.spec.ts` |
| E2E - Deactivate Staff | E2E | ⬜ Todo | `e2e/staff.spec.ts` |

---

### Phase 4: Patient Management (HIGH PRIORITY) - COMPONENT TESTS COMPLETE

Essential for schedule generation - patients are required inputs.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Patients Store - CRUD | Unit | ✅ Done | `stores/__tests__/patients.test.ts` |
| Patients Store - Filtering | Unit | ✅ Done | `stores/__tests__/patients.test.ts` |
| PatientListPage | Component | ✅ Done | `pages/__tests__/PatientListPage.test.ts` |
| PatientFormPage - Create | Component | ⬜ Todo | `pages/__tests__/PatientFormPage.test.ts` |
| PatientFormPage - Edit | Component | ⬜ Todo | `pages/__tests__/PatientFormPage.test.ts` |
| E2E - Add Patient | E2E | ⬜ Todo | `e2e/patients.spec.ts` |
| E2E - Edit Patient | E2E | ⬜ Todo | `e2e/patients.spec.ts` |

---

### Phase 5: Room Management (MEDIUM PRIORITY)

Required for complete schedule generation.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Rooms Store - CRUD | Unit | ⬜ Todo | `stores/__tests__/rooms.test.ts` |
| RoomListPage | Component | ⬜ Todo | `pages/__tests__/RoomListPage.test.ts` |
| RoomFormPage | Component | ⬜ Todo | `pages/__tests__/RoomFormPage.test.ts` |
| E2E - Room Management | E2E | ⬜ Todo | `e2e/rooms.spec.ts` |

---

### Phase 6: Scheduling Rules (MEDIUM PRIORITY)

Important for schedule quality but not blocking.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Rules Store - CRUD | Unit | ⬜ Todo | `stores/__tests__/rules.test.ts` |
| Rules Store - Categories | Unit | ⬜ Todo | `stores/__tests__/rules.test.ts` |
| RulesPage - List | Component | ⬜ Todo | `pages/__tests__/RulesPage.test.ts` |
| RulesPage - Create | Component | ⬜ Todo | `pages/__tests__/RulesPage.test.ts` |
| RulesPage - Voice Input | Component | ⬜ Todo | `pages/__tests__/RulesPage.test.ts` |
| E2E - Create Rule | E2E | ⬜ Todo | `e2e/rules.spec.ts` |
| E2E - Edit Rule | E2E | ⬜ Todo | `e2e/rules.spec.ts` |

---

### Phase 7: Availability Management (MEDIUM PRIORITY)

Staff time-off and availability requests.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Availability Store | Unit | ⬜ Todo | `stores/__tests__/availability.test.ts` |
| AvailabilityCalendar | Component | ⬜ Todo | `components/__tests__/AvailabilityCalendar.test.ts` |
| TimeOffRequestModal | Component | ⬜ Todo | `components/__tests__/TimeOffRequestModal.test.ts` |
| PendingRequestsPanel | Component | ⬜ Todo | `components/__tests__/PendingRequestsPanel.test.ts` |
| E2E - Request Time Off | E2E | ⬜ Todo | `e2e/availability.spec.ts` |
| E2E - Approve Request | E2E | ⬜ Todo | `e2e/availability.spec.ts` |

---

### Phase 8: User Management (MEDIUM PRIORITY)

Organization user administration.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Users Store - CRUD | Unit | ⬜ Todo | `stores/__tests__/users.test.ts` |
| UsersPage - List | Component | ⬜ Todo | `pages/__tests__/UsersPage.test.ts` |
| UsersPage - Invite | Component | ⬜ Todo | `pages/__tests__/UsersPage.test.ts` |
| E2E - Invite User | E2E | ⬜ Todo | `e2e/users.spec.ts` |
| E2E - Edit User Role | E2E | ⬜ Todo | `e2e/users.spec.ts` |

---

### Phase 9: Organization Settings (MEDIUM PRIORITY)

Configuration and customization.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Organizations Store | Unit | ⬜ Todo | `stores/__tests__/organizations.test.ts` |
| SettingsPage - Branding | Component | ⬜ Todo | `pages/__tests__/SettingsPage.test.ts` |
| SettingsPage - Labels | Component | ⬜ Todo | `pages/__tests__/SettingsPage.test.ts` |
| SettingsPage - Portal | Component | ⬜ Todo | `pages/__tests__/SettingsPage.test.ts` |
| E2E - Update Branding | E2E | ⬜ Todo | `e2e/settings.spec.ts` |

---

### Phase 10: Dashboard (LOWER PRIORITY)

Display-focused, less logic to test.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| DashboardPage - Stats | Component | ⬜ Todo | `pages/__tests__/DashboardPage.test.ts` |
| DashboardPage - Widgets | Component | ⬜ Todo | `pages/__tests__/DashboardPage.test.ts` |
| StatCard Component | Component | ⬜ Todo | `components/__tests__/StatCard.test.ts` |

---

### Phase 11: Super Admin Features (LOWER PRIORITY)

Limited user base, lower priority.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| SuperAdminUsers Store | Unit | ⬜ Todo | `stores/__tests__/superAdminUsers.test.ts` |
| OrganizationsPage | Component | ⬜ Todo | `pages/__tests__/OrganizationsPage.test.ts` |
| SuperAdminUsersPage | Component | ⬜ Todo | `pages/__tests__/SuperAdminUsersPage.test.ts` |
| TemplatesPage | Component | ⬜ Todo | `pages/__tests__/TemplatesPage.test.ts` |
| E2E - Create Organization | E2E | ⬜ Todo | `e2e/super-admin.spec.ts` |
| E2E - Switch Context | E2E | ⬜ Todo | `e2e/super-admin.spec.ts` |

---

### Phase 12: BAA Compliance (LOWER PRIORITY)

Specialized compliance feature.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| BAA Store | Unit | ⬜ Todo | `stores/__tests__/baa.test.ts` |
| BaaPage - Status | Component | ⬜ Todo | `pages/__tests__/BaaPage.test.ts` |
| BaaPage - Signing | Component | ⬜ Todo | `pages/__tests__/BaaPage.test.ts` |
| E2E - Sign BAA | E2E | ⬜ Todo | `e2e/baa.spec.ts` |

---

### Phase 13: Patient Portal (LOWER PRIORITY)

Separate user base, less frequent changes.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Portal Auth Store | Unit | ⬜ Todo | `stores/__tests__/portalAuth.test.ts` |
| PortalLoginPage | Component | ⬜ Todo | `pages/__tests__/PortalLoginPage.test.ts` |
| PortalDashboard | Component | ⬜ Todo | `pages/__tests__/PortalDashboard.test.ts` |
| PortalAppointments | Component | ⬜ Todo | `pages/__tests__/PortalAppointments.test.ts` |
| E2E - Portal Login | E2E | ⬜ Todo | `e2e/portal.spec.ts` |
| E2E - View Appointments | E2E | ⬜ Todo | `e2e/portal.spec.ts` |
| E2E - Self-Booking | E2E | ⬜ Todo | `e2e/portal.spec.ts` |

---

### Phase 14: Voice Features (LOWER PRIORITY)

Complex to test, requires mocking WebSocket/audio.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| VoiceInput Component | Component | ⬜ Todo | `components/__tests__/VoiceInput.test.ts` |
| Voice Parsing Utils | Unit | ⬜ Todo | `utils/__tests__/voice.test.ts` |
| VoiceHintsModal | Component | ⬜ Todo | `components/__tests__/VoiceHintsModal.test.ts` |

---

### Phase 15: UI Components (ONGOING)

Test as needed when modifying components.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| Button | Component | ⬜ Todo | `components/ui/__tests__/Button.test.ts` |
| Card | Component | ⬜ Todo | `components/ui/__tests__/Card.test.ts` |
| Modal | Component | ⬜ Todo | `components/ui/__tests__/Modal.test.ts` |
| DataTable | Component | ⬜ Todo | `components/ui/__tests__/DataTable.test.ts` |
| Pagination | Component | ⬜ Todo | `components/ui/__tests__/Pagination.test.ts` |
| FormInput | Component | ⬜ Todo | `components/ui/__tests__/FormInput.test.ts` |
| FormSelect | Component | ⬜ Todo | `components/ui/__tests__/FormSelect.test.ts` |
| Alert | Component | ⬜ Todo | `components/ui/__tests__/Alert.test.ts` |
| Badge | Component | ⬜ Todo | `components/ui/__tests__/Badge.test.ts` |
| Toggle | Component | ⬜ Todo | `components/ui/__tests__/Toggle.test.ts` |
| Tabs | Component | ⬜ Todo | `components/ui/__tests__/Tabs.test.ts` |
| SearchBox | Component | ⬜ Todo | `components/ui/__tests__/SearchBox.test.ts` |

---

### Phase 16: Help & Documentation (LOWEST PRIORITY)

Static content, minimal logic.

| Feature | Test Type | Status | File |
|---------|-----------|--------|------|
| HelpPage | Component | ⬜ Todo | `pages/__tests__/HelpPage.test.ts` |
| HelpArticlePage | Component | ⬜ Todo | `pages/__tests__/HelpArticlePage.test.ts` |
| HelpMarkdown Component | Component | ⬜ Todo | `components/__tests__/HelpMarkdown.test.ts` |

---

## Test Backlog

### Ready to Implement

The following tests should be implemented next, in order:

1. **ScheduleViewPage** - Schedule viewing and session editing
2. **StaffFormPage** - Staff create/edit form component
3. **PatientFormPage** - Patient create/edit form component
4. **E2E - Staff Management** - Add, edit, deactivate staff flows
5. **E2E - Patient Management** - Add, edit patient flows

### Recently Completed

| Test | Date | Tests Added |
|------|------|-------------|
| SchedulePage | 2026-01-01 | 23 tests |
| StaffListPage | 2026-01-01 | 28 tests |
| PatientListPage | 2026-01-01 | 31 tests |
| E2E - Schedule Generation | 2026-01-01 | 15 tests |

### Blocked / Needs Design

| Test | Blocker | Notes |
|------|---------|-------|
| Voice Input tests | WebSocket mocking | Need to design audio/WebSocket test strategy |
| MFA E2E tests | Test user setup | Need MFA-enabled test account |

### Technical Debt

| Item | Description |
|------|-------------|
| Vue Router warnings | Tests show "No match found for location" warnings - cosmetic |
| Test utilities | Consider creating shared test helpers for common patterns |
| Mock factories | Create factories for User, Organization, Staff, etc. |

---

## Progress Tracking

### Summary

| Phase | Total Tests | Completed | Remaining |
|-------|-------------|-----------|-----------|
| 1. Authentication | 10 | 10 | 0 |
| 2. Schedules | 11 | 8 | 3 |
| 3. Staff | 8 | 3 | 5 |
| 4. Patients | 7 | 3 | 4 |
| 5. Rooms | 4 | 0 | 4 |
| 6. Rules | 7 | 0 | 7 |
| 7. Availability | 6 | 0 | 6 |
| 8. Users | 5 | 0 | 5 |
| 9. Settings | 5 | 0 | 5 |
| 10. Dashboard | 3 | 0 | 3 |
| 11. Super Admin | 6 | 0 | 6 |
| 12. BAA | 4 | 0 | 4 |
| 13. Portal | 7 | 0 | 7 |
| 14. Voice | 3 | 0 | 3 |
| 15. UI Components | 12 | 0 | 12 |
| 16. Help | 3 | 0 | 3 |
| **Total** | **101** | **24** | **77** |

*Note: Test counts are for test categories, not individual test cases. Actual test case count: 221*

### Coverage Goals

| Milestone | Target Coverage | Tests Completed |
|-----------|-----------------|-----------------|
| MVP | 30% | Phases 1-4 |
| Beta | 50% | Phases 1-8 |
| Production | 70% | Phases 1-12 |
| Complete | 80%+ | All phases |

---

## Maintenance Notes

### Updating This Plan

When implementing tests:
1. Update the Status column from ⬜ Todo to ✅ Done
2. Add the actual file path if different from suggested
3. Update the Progress Tracking summary
4. Move completed items from "Ready to Implement" backlog

### Adding New Features

When new features are added to the application:
1. Add a new row to the appropriate phase
2. If it's a new feature area, create a new phase section
3. Prioritize based on business criticality
4. Update the Total Tests count

### Test Review Checklist

Before marking a test as complete:
- [ ] Test passes consistently (no flakiness)
- [ ] Test covers happy path
- [ ] Test covers error cases
- [ ] Test is independent (doesn't rely on other tests)
- [ ] Test uses meaningful assertions
- [ ] Test file follows naming conventions
