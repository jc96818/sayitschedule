# Staff Availability & Shift Management: Gap Analysis

**Date:** December 29, 2024
**Compared Against:** TCP Humanity, Paycor

---

## Current Say It Schedule Features

| Feature | Status | Notes |
|---------|--------|-------|
| Default weekly hours | ✅ Implemented | `defaultHours` JSON field per staff |
| Availability rules via voice | ✅ Implemented | "John only works Mon/Wed/Fri" |
| Session conflict detection | ✅ Implemented | Overlapping sessions flagged |
| Certification matching | ✅ Implemented | Skills-based assignment |
| AI schedule generation | ✅ Implemented | Respects all constraints |
| Holiday management | ✅ Implemented | Federal + custom holidays |
| Voice-powered modifications | ✅ Implemented | Move/cancel sessions by voice |

---

## Feature Gaps vs. Competitors

### 🔴 Critical Gaps (High-value features missing)

| Feature | TCP Humanity | Paycor | Say It Schedule |
|---------|--------------|--------|-----------------|
| **Shift Swapping** | ✅ Employee-initiated with approval | ✅ Self-service with manager approval | ❌ Missing |
| **Open Shift Marketplace** | ✅ Post open shifts for self-assignment | ✅ Drop/pick up open shifts | ❌ Missing |
| **Time-Off Request System** | ✅ Full request/approval workflow | ✅ Employee self-service requests | ❌ Missing (schema exists but unused) |
| **Mobile App** | ✅ iOS/Android apps | ✅ Full mobile scheduling app | ❌ Web-only |
| **Real-Time Notifications** | ✅ Email, SMS, push | ✅ SMS, email, push notifications | ❌ Missing |
| **Overtime Tracking/Alerts** | ✅ Rules, alerts, reporting | ✅ Threshold alerts | ❌ Missing |

### 🟡 Moderate Gaps (Competitive differentiators)

| Feature | TCP Humanity | Paycor | Say It Schedule |
|---------|--------------|--------|-----------------|
| **Shift Bidding** | ✅ Employees bid on shifts | ❌ | ❌ Missing |
| **AI Demand Forecasting** | ✅ AI-driven staffing predictions | ✅ Historical data forecasting | ⚠️ Partial (AI generation only) |
| **Schedule Templates** | ✅ Recurring templates | ✅ Copy/paste, weekly templates | ❌ Missing |
| **Break Management** | ✅ Break rules enforcement | ✅ Automated break scheduling | ❌ Missing |
| **Multi-Location Support** | ✅ | ✅ Unlimited locations | ❌ Missing |
| **Labor Cost Tracking** | ✅ Budget optimization | ✅ Real-time cost comparison | ❌ Missing |
| **Compliance Rules Engine** | ✅ Federal/state law compliance | ✅ Built-in compliance checks | ⚠️ Basic (holiday only) |

### 🟢 Minor Gaps (Nice-to-have)

| Feature | TCP Humanity | Paycor | Say It Schedule |
|---------|--------------|--------|-----------------|
| **Manager Dashboard Analytics** | ✅ Trends, shift patterns | ✅ Historical trends | ❌ Missing |
| **Seniority-Based Scheduling** | ✅ Priority by tenure | ❌ | ❌ Missing |
| **Learning Management** | ✅ Training tracking | ❌ | ❌ Missing |
| **Calendar Integration** | ✅ Google/Outlook sync | ✅ External calendar sync | ❌ Missing |
| **Geolocation Clock-In** | ✅ Location verification | ✅ | ❌ N/A (therapy context) |

---

## Detailed Analysis of Critical Gaps

### 1. Time-Off Request System

The `StaffAvailability` table exists in `backend/prisma/schema.prisma` but is **completely unused**. No repository, routes, or UI exist to:
- Submit time-off requests
- Approve/deny requests
- Track vacation balances
- Handle partial-day availability

**Competitor standard**: Full workflow with employee self-service → manager approval → calendar update.

### 2. Shift Swapping / Open Shifts

No mechanism for:
- Staff to request shift swaps with colleagues
- Managers to post unfilled shifts
- Staff to claim open shifts
- Approval workflows for schedule changes

**Competitor standard**: Employee-driven marketplace with manager oversight.

### 3. Real-Time Notifications

No notification system for:
- Schedule published alerts
- Shift reminders
- Time-off request status
- Schedule changes

**Competitor standard**: Multi-channel (email + SMS + push) with configurable preferences.

### 4. Overtime Management

No tracking of:
- Weekly hours worked
- Overtime thresholds
- Alerts when approaching limits
- Overtime cost impact

**Competitor standard**: Automatic alerts + blocking rules + cost reporting.

---

## Recommendations by Priority

### Phase 1 - Foundation (Leverage existing schema)

1. Implement `StaffAvailability` repository/routes/UI for specific date overrides
2. Add time-off request workflow with approval states
3. Add email notifications for schedule publish

### Phase 2 - Employee Self-Service

4. Add shift swap request feature
5. Add open shift claiming
6. Add employee availability preferences UI

### Phase 3 - Advanced

7. Mobile app or PWA
8. SMS/push notifications
9. Overtime tracking and alerts
10. Schedule templates and copying

---

## Sources

- [TCP Humanity Schedule - Official Product Page](https://tcpsoftware.com/products/humanity/)
- [TCP Humanity Review 2025 - Connecteam](https://connecteam.com/reviews/humanity/)
- [TCP Humanity Features - Capterra](https://www.capterra.com/p/248404/Humanity/)
- [Paycor Scheduling Software](https://www.paycor.com/hcm-software/scheduling-software/)
- [Paycor Scheduling Reviews 2025 - SelectHub](https://www.selecthub.com/p/employee-scheduling-software/paycor-scheduling/)
- [Paycor Time-Off Management Announcement](https://www.paycor.com/company/news-press/paycor-unveils-innovative-features-to-redefine-time-off-management/)
