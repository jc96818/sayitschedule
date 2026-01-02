# Marketing Content Review & Update Plan

## Executive Summary

The current landing page focuses primarily on voice-guided scheduling and security features. However, several major features have been added since the marketing content was created that are not represented. This document outlines the gaps and provides a plan to update the marketing content.

---

## Current Landing Page Content Analysis

### What's Currently Covered

| Feature | Coverage | Notes |
|---------|----------|-------|
| Voice commands | ✅ Good | Hero section, "How it works" step 1 |
| Draft-publish workflow | ✅ Good | "Clear review before publish" card |
| Rule-aware scheduling | ✅ Good | "Rule-aware changes" value card |
| BAA/HIPAA compliance | ✅ Good | Hero badge + security section |
| MFA support | ✅ Good | Hero badge + security section |
| Role-based access | ✅ Good | Hero badge + security section |
| Audit trails | ✅ Good | Hero badge + security section |

### Major Gaps Identified

#### 1. **Patient/Caregiver Portal** (HIGH PRIORITY)
**Current Status:** Not mentioned at all
**Actual Features:**
- Passwordless login (email/SMS)
- View upcoming and past appointments
- Cancel and reschedule appointments
- Self-booking with availability browser
- Appointment confirmations
- Organization branding customization

**Impact:** This is a significant differentiator for therapy practices. Caregivers can manage appointments without calling the clinic.

#### 2. **Self-Booking System** (HIGH PRIORITY)
**Current Status:** Not mentioned
**Actual Features:**
- Patients/caregivers can browse available slots
- Configurable lead time and booking windows
- Optional approval workflow
- Temporary hold system prevents double-booking

**Impact:** Major time saver for front desk staff and improves patient experience.

#### 3. **AI-Powered Schedule Generation** (MEDIUM PRIORITY)
**Current Status:** Only implied through voice commands
**Actual Features:**
- Automatic schedule generation respecting all rules
- Constraint-based optimization (staff availability, room capabilities, patient preferences)
- Gender pairing rules
- Certification matching
- Schedule versioning and copying

**Impact:** The "smart" aspect of the scheduling engine is undersold.

#### 4. **Custom Terminology/Labels** (MEDIUM PRIORITY)
**Current Status:** Not mentioned
**Actual Features:**
- Customize "therapist" → "specialist", "provider", etc.
- Customize "patient" → "client", "student", etc.
- Customize room and equipment labels
- Labels apply throughout app including portal

**Impact:** Practices in different healthcare verticals (PT, OT, speech, behavioral) use different terminology.

#### 5. **Email/SMS Reminders** (MEDIUM PRIORITY)
**Current Status:** Not mentioned
**Actual Features:**
- Appointment reminders
- Portal login codes
- Confirmation requests

**Impact:** Reduces no-shows, a common pain point for therapy practices.

#### 6. **PDF Schedule Export** (LOW PRIORITY)
**Current Status:** Only briefly mentioned ("Print-ready views")
**Actual Features:**
- Organization branding on exports
- Multiple view formats
- Staff distribution copies

#### 7. **Time-Off Requests** (LOW PRIORITY)
**Current Status:** Not mentioned
**Actual Features:**
- Staff can request time off
- Integrates with availability calculations

#### 8. **Help Center / Documentation** (LOW PRIORITY)
**Current Status:** Not mentioned
**Actual Features:**
- 31+ help articles
- Searchable knowledge base
- Role-appropriate content
- In-app help access

---

## Recommended Updates

### Phase 1: High-Impact Additions

#### Add "Patient Portal" Section
Create a new section between "How it works" and "Security" to highlight the patient/caregiver portal:

**Suggested Content:**
```
## Empower patients and caregivers

Give families visibility and control—without more phone calls.

- View upcoming appointments: Patients see their schedule at a glance
- Self-booking: Let caregivers book available slots on their own time
- Easy rescheduling: Move appointments without playing phone tag
- Passwordless login: Secure access via email or SMS code
- Your branding: Customizable portal with your logo and colors
```

#### Update Hero Section
Add a badge or mention of the patient portal:
- Add badge: `Patient portal`
- Update subtitle to mention self-service: "Voice-guided scheduling with a patient portal for self-booking..."

#### Update "How it works" Section
Consider adding a 4th step or updating step 3:
- Current Step 3: "Publish schedules" → "Publish and notify"
- Add mention: "Patients and caregivers get notified and can view their schedules online."

### Phase 2: Medium-Impact Additions

#### Add "Works Your Way" Section (Custom Labels)
**Suggested Content:**
```
## Built for your practice

Whether you call them therapists, specialists, or providers—Say It Schedule adapts to your terminology.

- Customize labels for staff, patients, rooms, and equipment
- Your terms appear everywhere: the app, portal, and printed schedules
- No confusing generic language
```

#### Enhance "Product" Section
Add a value card for AI-powered scheduling:
```
### Smart schedule generation
Let the system generate optimized schedules that respect staff availability, room capabilities, and patient preferences.
```

#### Add Reminders Mention
In the security section or as a new value card:
```
### Reduce no-shows
Automated email and SMS reminders keep patients and caregivers informed.
```

### Phase 3: Polish and Secondary Features

#### Update "Print-ready views" mention
Change to: "Generate branded PDF schedules for staff distribution."

#### Footer Enhancements
- Add links to Help Center (when public)
- Add links to Privacy Policy and Terms of Service

---

## Navigation Updates

Consider adding a "Features" dropdown or expanding the current navigation:

**Current:**
- Product
- How it works
- Security
- Contact

**Suggested:**
- Features (dropdown)
  - Voice Scheduling
  - Patient Portal
  - Smart Generation
  - Custom Labels
- Security
- Pricing (future)
- Contact

---

## Voice Command Examples to Update

The current example focuses on moving a session. Consider adding variety:

**Current:** "Move Jordan's Tuesday session to 2pm and keep Room 3."

**Additional Examples:**
- "Cancel all of Dr. Smith's appointments next Monday"
- "Add a new patient named Alex who needs 3 sessions per week"
- "Show me available slots for Maria on Thursday afternoon"
- "Swap Sarah and Mike's 10am sessions"

---

## SEO and Messaging Considerations

### Keywords Currently Missing
- Patient portal
- Self-booking / online booking
- Appointment reminders
- Therapy scheduling software
- Healthcare scheduling
- HIPAA compliant scheduling

### Target Audience Expansion
Current focus: "therapy practices"

Consider also mentioning:
- Physical therapy (PT)
- Occupational therapy (OT)
- Speech therapy
- Behavioral health
- Pediatric therapy practices
- Multi-discipline clinics

---

## Implementation Priority

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Add Patient Portal section | High | Medium | High |
| Update hero badges | High | Low | Medium |
| Add self-booking mention | High | Low | High |
| Update "How it works" step 3 | Medium | Low | Medium |
| Add AI scheduling value card | Medium | Low | Medium |
| Add custom labels section | Medium | Medium | Medium |
| Add reminders mention | Medium | Low | Medium |
| Update navigation structure | Low | Medium | Low |
| Add more voice examples | Low | Low | Low |
| SEO keyword optimization | Low | Low | Medium |

---

## Files to Modify

1. **[LandingPage.vue](../frontend/src/pages/LandingPage.vue)** - Main marketing content
2. Consider creating a **[FeaturesPage.vue](../frontend/src/pages/)** - Dedicated features page (future)
3. Consider creating a **[PricingPage.vue](../frontend/src/pages/)** - Pricing page (future)

---

## Next Steps

1. Review this plan with stakeholders
2. Prioritize which updates to implement first
3. Create mockups/wireframes for new sections
4. Implement Phase 1 updates
5. A/B test if possible
6. Iterate based on conversion data
