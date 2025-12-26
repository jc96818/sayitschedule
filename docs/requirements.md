# Say It Schedule - Staff Scheduling Application

## Requirements Document

**Version:** 2.0
**Date:** December 26, 2024
**Status:** Draft

---

## 1. Executive Summary

This document outlines the requirements for Say It Schedule (sayitschedule.com), a multi-tenant, voice-powered staff scheduling application. The application enables administrators to create weekly staff schedules using AI-powered voice input for rule creation and schedule modifications.

The platform supports multiple organizations, each with their own branding, subdomain, users, staff, patients, and schedules. A super admin (owner) can manage all organizations from a central interface.

---

## 2. Multi-Tenancy Architecture

### 2.1 Organization Model

- Each organization is a self-contained tenant with isolated data
- Organizations have unique subdomains (e.g., `projecthope.sayitschedule.com`, `sunnyside.sayitschedule.com`)
- Custom branding per organization (logo, colors, name)
- All data (users, staff, patients, schedules, rules) is scoped to an organization

### 2.2 Subdomain Handling

- **Production**: Subdomains route to the appropriate organization context
- **Local Development**: Organization context is set via `ORG_DOMAIN` environment variable in `.env`
- Organization lookup by subdomain on each request
- Invalid/inactive subdomains redirect to a "not found" or main landing page

### 2.3 Data Isolation

- All queries are scoped to the current organization context
- Cross-organization data access is prohibited except for Super Admin
- Database uses `organization_id` foreign key on all tenant-scoped tables

---

## 3. User Roles and Permissions

### 3.1 Super Admin (Owner)

- Platform-level access across all organizations
- Create, edit, activate/deactivate organizations
- Configure organization branding and subdomain
- View list of all organizations with key metrics
- Switch context to any organization (view app as that org's Admin)
- Manage Super Admin accounts
- Access platform-wide audit logs and reports
- Cannot directly modify organization-level data without switching context

### 3.2 Administrator (Organization-level)

- Full access within their organization
- Create, modify, and delete scheduling rules
- Manage staff and patient records
- Generate and publish schedules
- View and print all schedules
- Manage user accounts and permissions within organization
- Access organization audit logs and reports
- Configure organization settings (holidays, preferences)

### 3.3 Admin Assistant

- Create and modify scheduling rules
- Manage staff and patient records
- Generate and publish schedules
- View and print all schedules
- Cannot manage user accounts
- Cannot delete core system data

### 3.4 Staff (Therapist)

- View published schedules (all staff visible)
- View own profile information
- Submit availability/time-off requests (future enhancement)
- Cannot modify schedules or rules

---

## 4. Core Features

### 4.1 Voice-Powered Rule Creation

#### 4.1.1 Rule Categories

- **Gender Pairing Rules**: Define therapist-patient gender matching constraints
- **Session Rules**: Duration, frequency, and timing of sessions
- **Availability Rules**: Working days, hours, and exclusions (federal holidays)
- **Specific Pairing Rules**: Force or prevent specific therapist-patient combinations
- **Certification Rules**: Match therapists to patients based on required certifications/specializations

#### 4.1.2 Voice Input Processing

- Speech-to-text conversion via browser API or cloud service
- AI interpretation of natural language rules
- Rule confirmation display before saving
- Ability to edit AI-interpreted rules manually
- Support for rule modification via voice ("Change the session duration to 90 minutes")

#### 4.1.3 Example Rules

- "Male therapists can only be scheduled with male patients"
- "Female therapists can be scheduled with female or male patients"
- "Therapists will be scheduled for two 1-hour sessions per day, Monday through Friday"
- "Exclude federal holidays from scheduling"
- "Always pair Ethan with patient Emilio"
- "Never schedule Sarah with patient Marcus"
- "John only works Monday, Wednesday, and Friday"

### 4.2 Staff Management

#### 4.2.1 Staff Profile Data

- Full name
- Employee ID
- Gender
- Contact information (email, phone)
- Certifications/specializations
- Default working hours
- Hire date
- Status (active/inactive)

#### 4.2.2 Voice-Powered Staff Management

Administrators can manage staff using voice commands or manual entry forms.

**Example Voice Commands:**

- "New staff member named Adam Smith, male"
- "Add therapist Sarah Johnson, female, certified in pediatrics"
- "Create staff member John Doe, male, email john.doe@example.com"
- "Update Adam Smith's availability to Monday and Friday"
- "Set Sarah Johnson's hours to 9 AM to 5 PM"
- "Add certification ABA to John Doe"
- "Remove Adam Smith's Tuesday availability"
- "Mark Sarah Johnson as inactive"
- "Change John Doe's phone number to 555-1234"

**Voice Input Workflow:**

1. Voice command captured and transcribed
2. AI interprets intent (create, update, or query)
3. Parsed data displayed for confirmation
4. User confirms or edits before saving
5. Manual form pre-populated for additional edits if needed

#### 4.2.3 Availability Management

- Weekly default availability
- Time-off requests and approvals
- Recurring unavailability (e.g., "No Fridays")
- Temporary schedule changes

### 4.3 Patient Management

#### 4.3.1 Patient Profile Data

- Full name (or identifier for privacy)
- Patient ID
- Gender
- Required session frequency
- Preferred session times (optional)
- Required therapist certifications
- Special notes/requirements
- Status (active/inactive)

#### 4.3.2 Voice-Powered Patient Management

Administrators can manage patients using voice commands or manual entry forms.

**Example Voice Commands:**

- "New patient named Emily Carter, female"
- "Add patient Michael Brown, male, requires 2 sessions per week"
- "Create patient ID 12345, named Lisa Wong, female, needs ABA certified therapist"
- "Update Emily Carter's session frequency to 3 times per week"
- "Set Michael Brown's preferred time to mornings"
- "Add note to Lisa Wong: prefers quiet environment"
- "Change Emily Carter's required certification to speech therapy"
- "Mark patient Michael Brown as inactive"
- "Update patient 12345 to require pediatric certification"

**Voice Input Workflow:**

1. Voice command captured and transcribed
2. AI interprets intent (create, update, or query)
3. Parsed data displayed for confirmation
4. User confirms or edits before saving
5. Manual form pre-populated for additional edits if needed

### 4.4 Schedule Generation

#### 4.4.1 Generation Process

1. Scheduler selects target week(s)
2. System loads current rules, staff availability, and patient list
3. AI generates optimal schedule based on all constraints
4. Preview displayed for review
5. Voice or manual modifications applied
6. Schedule published when approved

#### 4.4.2 AI Scheduling Considerations

- Honor all active rules
- Maximize patient coverage
- Distribute workload fairly among therapists
- Minimize schedule conflicts
- Flag any constraint violations or impossibilities
- Provide reasoning for scheduling decisions when requested

#### 4.4.3 Schedule Preview

- Calendar view (daily/weekly)
- List view by therapist
- List view by patient
- Conflict/warning indicators
- Unscheduled patient alerts

### 4.5 Voice-Powered Schedule Modification

#### 4.5.1 Modification Commands

- "Move Ethan's 9 AM session to 2 PM"
- "Swap Tuesday and Wednesday for all therapists"
- "Remove Friday afternoon sessions for Sarah"
- "Add a session for patient Emilio on Thursday at 10 AM with any available therapist"
- "Cancel all sessions on December 26th"

#### 4.5.2 Modification Workflow

1. Voice command captured and transcribed
2. AI interprets intent and identifies affected sessions
3. Preview of changes displayed
4. Confirmation required before applying
5. Ability to undo recent changes

### 4.6 Schedule Publishing and Distribution

#### 4.6.1 Publishing

- Draft vs. Published status
- Version history
- Publish notifications (email/in-app)
- Lock schedule after publishing (require unlock to edit)

#### 4.6.2 PDF Export

- Full weekly schedule
- Individual therapist schedules
- Daily schedule view
- Professional formatting with organization branding
- Print-optimized layout

### 4.7 Holiday Management

#### 4.7.1 Federal Holidays (US)

- New Year's Day
- Martin Luther King Jr. Day
- Presidents' Day
- Memorial Day
- Juneteenth
- Independence Day
- Labor Day
- Columbus Day
- Veterans Day
- Thanksgiving Day
- Christmas Day

#### 4.7.2 Custom Holidays/Closures

- Organization-specific closure dates
- Weather closures
- Special events

### 4.8 Organization Management (Super Admin)

#### 4.8.1 Organization List View

- Table of all organizations with key metrics:
  - Organization name
  - Subdomain
  - Status (active/inactive)
  - Number of users
  - Number of staff
  - Number of patients
  - Created date
- Search and filter capabilities
- Quick actions (edit, activate/deactivate, switch context)

#### 4.8.2 Organization Creation/Edit

- Organization name
- Subdomain (validated for uniqueness and format)
- Status (active/inactive)
- Branding settings:
  - Logo upload
  - Primary color
  - Secondary color
  - Custom display name
- Initial administrator account setup (on creation)

#### 4.8.3 Context Switching

- Super Admin can select an organization to "enter" from the organization list
- When in organization context, Super Admin sees the app as an Admin for that org
- Visual indicator showing current organization context
- Easy way to exit back to Super Admin view

---

## 5. Technical Requirements

### 5.1 Technology Stack

- **Frontend**: Vue.js 3 with TypeScript
- **Backend**: Fastify (Node.js)
- **Database**: PostgreSQL (existing RDS instance, managed externally)
- **Infrastructure**: AWS ECS (Elastic Container Service)
- **Infrastructure as Code**: Terraform
- **Containerization**: Docker

### 5.2 Platform

- Web-based application (responsive design)
- Support for modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile-friendly for schedule viewing

### 5.3 Authentication & Security

- Secure user authentication (email/password)
- Role-based access control with organization scoping
- Session management with JWT tokens
- HIPAA compliance considerations for patient data
- Audit logging for all schedule changes
- Organization isolation enforced at API and database levels

### 5.4 Voice Processing

- Browser-based speech recognition (Web Speech API)
- Fallback to cloud-based speech service if needed
- Visual feedback during voice capture
- Text display of recognized speech for confirmation

### 5.5 AI Integration

- Natural language processing for rule interpretation
- Constraint-based schedule optimization
- Conversational interface for modifications
- Clear communication of AI decisions and limitations

### 5.6 Data Storage

- PostgreSQL database (existing RDS instance)
- Database connection via environment variables
- Organization-scoped data with `organization_id` foreign keys
- Schedule version history
- Rule change audit trail
- Regular backups (managed by RDS)

### 5.7 Infrastructure & Deployment

- **AWS ECS**: Container orchestration for application deployment
- **Terraform**: Infrastructure provisioning and management
  - ECS task definitions and services
  - Load balancer configuration
  - Security groups and networking
  - Environment variable management
  - Note: RDS instance managed separately (different Terraform state)
- **Docker**: Application containerization
  - Separate containers for frontend and backend (or combined)
  - Multi-stage builds for optimized images

### 5.8 Environment Configuration

- Environment variables for configuration:
  - `DATABASE_URL`: PostgreSQL connection string
  - `ORG_DOMAIN`: Organization domain for local development
  - `JWT_SECRET`: Secret for token signing
  - `NODE_ENV`: Environment (development/staging/production)
  - Additional service-specific variables

### 5.9 Performance

- Schedule generation within 30 seconds for typical workloads
- Real-time voice transcription
- Responsive UI with loading indicators

---

## 6. User Interface Requirements

### 6.1 Key Screens

1. **Login Screen**
   - Email/password authentication
   - Password reset option
   - Organization branding displayed (logo, colors)

2. **Super Admin Dashboard**
   - Organization list with metrics
   - Quick actions for organization management
   - Platform-wide statistics
   - System health indicators

3. **Organization Dashboard** (Admin/Admin Assistant)
   - Current week schedule overview
   - Quick actions (generate schedule, view staff, view patients)
   - Alerts and notifications
   - Upcoming schedule status
   - Organization branding applied

4. **Rule Management**
   - List of active rules with categories
   - Voice input button with visual feedback
   - Manual rule entry form
   - Rule enable/disable toggles
   - Rule priority/ordering

5. **Staff Management**
   - Staff directory with search/filter
   - Individual staff profile view/edit
   - Availability calendar per staff member
   - Bulk availability updates
   - Voice input button for adding/editing staff
   - Manual entry form with all fields

6. **Patient Management**
   - Patient directory with search/filter
   - Individual patient profile view/edit
   - Session requirements summary
   - Voice input button for adding/editing patients
   - Manual entry form with all fields

7. **Schedule Generation**
   - Week selector (single or multiple weeks)
   - Generate button with progress indicator
   - Constraint violation warnings

8. **Schedule Preview/Edit**
   - Interactive calendar view
   - Voice modification interface
   - Change history panel
   - Publish/save draft buttons

9. **Published Schedule View**
   - Read-only calendar display
   - Filter by therapist/patient
   - PDF export button
   - Print button

10. **Settings (Admin only)**
    - User management (within organization)
    - Holiday configuration
    - System preferences
    - Organization branding settings

11. **Organization Management (Super Admin only)**
    - Organization list view
    - Organization create/edit forms
    - Branding configuration
    - Context switch interface

### 6.2 Voice Interface Elements

- Prominent microphone button
- Recording indicator (visual + audio cue)
- Real-time transcription display
- "Listening..." / "Processing..." states
- Confirmation dialog with parsed interpretation
- Cancel/retry options

### 6.3 Multi-Tenant UI Elements

- Organization logo in header/sidebar
- Organization name display
- Color theme applied based on organization branding
- Super Admin context indicator when viewing as organization
- "Exit to Super Admin" button when in organization context

---

## 7. Data Entities

### 7.1 Organization

- id, name, subdomain, logo_url, primary_color, secondary_color, status, created_at, updated_at

### 7.2 User

- id, organization_id (nullable for Super Admin), email, password_hash, name, role, created_at, last_login

### 7.3 Staff

- id, organization_id, user_id (optional), name, gender, email, phone, certifications[], default_hours, status, created_at

### 7.4 Patient

- id, organization_id, name, identifier, gender, session_frequency, preferred_times, required_certifications[], notes, status, created_at

### 7.5 Rule

- id, organization_id, category, description, rule_logic (JSON), priority, is_active, created_by, created_at, updated_at

### 7.6 Schedule

- id, organization_id, week_start_date, status (draft/published), created_by, created_at, published_at, version

### 7.7 Session

- id, schedule_id, therapist_id, patient_id, date, start_time, end_time, notes, created_at

### 7.8 StaffAvailability

- id, staff_id, date, available, start_time, end_time, reason

### 7.9 AuditLog

- id, organization_id (nullable for platform-level), user_id, action, entity_type, entity_id, changes (JSON), timestamp

---

## 8. Future Enhancements (Out of Scope for V1)

- Staff self-service availability submission
- Patient portal for appointment viewing
- Automated email/SMS notifications
- Integration with calendar systems (Google, Outlook)
- Billing system integration
- Mobile native apps
- Multi-location support within organizations
- Recurring schedule templates
- Analytics and reporting dashboard
- Two-factor authentication
- SSO/SAML integration for enterprise organizations

---

## 9. Assumptions and Constraints

### 9.1 Assumptions

- All users have modern browsers with microphone access
- Practice operates Monday-Friday
- Sessions are 1 hour by default (configurable via rules)
- English language only for voice input
- Single timezone per organization
- Reasonable number of staff (<50) and patients (<200) per organization
- Database (RDS) is pre-provisioned and connection details provided

### 9.2 Constraints

- HIPAA compliance required for patient data handling
- Voice processing requires user permission for microphone
- AI schedule generation may require cloud API access
- RDS instance managed externally (no Terraform changes to database)

---

## 10. Success Criteria

- Schedulers can create rules via voice with >90% accuracy
- Schedule generation completes in <30 seconds
- All scheduling constraints are honored
- Staff can view schedules on mobile devices
- PDF exports are print-ready with organization branding
- System handles edge cases gracefully with clear error messages
- Super Admin can create and manage multiple organizations
- Organization data is properly isolated
- Application deploys successfully to AWS ECS via Terraform

---

## 11. Screen Mockup Requirements

The following screens require mockups for stakeholder review:

1. Login Page (with organization branding)
2. Super Admin Dashboard (organization list)
3. Organization Create/Edit Form
4. Main Dashboard (organization context)
5. Rule Management (with voice interface)
6. Staff List View
7. Staff Profile/Edit
8. Patient List View
9. Patient Profile/Edit
10. Schedule Generation Interface
11. Schedule Preview/Edit (with voice modification)
12. Published Schedule View (calendar format)
13. PDF Export Preview (with organization branding)
14. User Management (Admin)
15. Holiday/Settings Configuration
16. Organization Branding Settings

---

## Appendix A: Glossary

- **Organization**: A tenant in the multi-tenant system; represents a single practice or company
- **Super Admin**: Platform owner with access to all organizations
- **Scheduler**: Administrator or Admin Assistant who creates schedules
- **Session**: A single therapy appointment between one therapist and one patient
- **Rule**: A constraint or preference that governs how schedules are generated
- **Availability**: The times when a staff member is able to work
- **Draft Schedule**: A generated schedule that has not yet been published
- **Published Schedule**: A finalized schedule visible to all users
- **Subdomain**: The unique URL prefix for an organization (e.g., `projecthope` in `projecthope.sayitschedule.com`)
- **Context Switching**: Super Admin ability to view the app as if they were an Admin of a specific organization

---

## Appendix B: Federal Holiday Dates (2025)

| Holiday | Date |
| ------- | ---- |
| New Year's Day | January 1 |
| Martin Luther King Jr. Day | January 20 |
| Presidents' Day | February 17 |
| Memorial Day | May 26 |
| Juneteenth | June 19 |
| Independence Day | July 4 |
| Labor Day | September 1 |
| Columbus Day | October 13 |
| Veterans Day | November 11 |
| Thanksgiving Day | November 27 |
| Christmas Day | December 25 |

---

## Appendix C: Environment Variables

| Variable | Description | Required |
| -------- | ----------- | -------- |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ORG_DOMAIN` | Organization subdomain for local dev | Dev only |
| `JWT_SECRET` | Secret key for JWT token signing | Yes |
| `NODE_ENV` | Environment (development/staging/production) | Yes |
| `PORT` | Application port (default: 3000) | No |
| `AI_API_KEY` | API key for AI/LLM service | Yes |
| `AWS_REGION` | AWS region for services | Production |

---

*Document prepared for stakeholder review. Please provide feedback on requirements before proceeding to design phase.*
