# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Project Overview

Say It Schedule is a multi-tenant SaaS platform for scheduling therapy sessions using voice commands. It manages organizations, staff (therapists), patients, rooms, and generates optimized weekly schedules based on complex rules and constraints. Most major functions can be performed by the user speaking their requests into the microphone.

## Tech Stack

- **Frontend**: Vue 3, Vite, Pinia, TypeScript, Vue Router
- **Backend**: Fastify, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Infrastructure**: Docker, Terraform, AWS ECS Fargate, RDS

## Project Structure

```text
/backend          - Fastify API server
  /src/routes     - API endpoints
  /src/services   - Business logic
  /src/repositories - Data access layer
  /prisma         - Database schema & migrations
/frontend         - Vue 3 SPA
  /src/pages      - Page components
  /src/stores     - Pinia state management
  /src/components - Reusable UI components
/infrastructure   - Terraform AWS configs
/docs             - Documentation
```

## Common Commands

### Backend (run from /backend)

```bash
npm run dev                 # Start dev server with hot reload
npm run build               # Compile TypeScript
npm run test:run            # Run tests once
npm run test                # Run tests in watch mode
npm run db:migrate          # Run Prisma migrations (dev)
npm run db:migrate:deploy   # Deploy migrations (production)
npm run db:studio           # Open Prisma Studio GUI
npm run lint                # ESLint with auto-fix
```

### Frontend (run from /frontend)

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run type-check   # Vue TSC type checking
npm run lint         # ESLint with auto-fix
```

### Docker

```bash
docker-compose up -d         # Start local PostgreSQL
docker-compose down          # Stop containers
```

### Database Access

The local PostgreSQL container is named `sayitschedule-db`. To access:

```bash
# Connect to psql
docker exec -it sayitschedule-db psql -U postgres -d sayitschedule

# Run a query directly
docker exec sayitschedule-db psql -U postgres -d sayitschedule -c "SELECT * FROM users;"
```

### Test Accounts

These test accounts are available:

- **Super Admin**: `superadmin@sayitschedule.com` / `sayitadmin2025`
- **Admin**: `admin@demo.sayitschedule.com` / `sayitadmin2025`
- **Assistant**: `assistant@demo.sayitschedule.com` / `sayitadmin2025`

Access the demo organization at `http://demo.localhost:5173` in development.

## Environment Variables

Copy `.env.example` to `.env` for local development. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Authentication secret
- `OPENAI_API_KEY` - For voice input parsing

Local database URL: `postgresql://postgres:postgres@localhost:5433/sayitschedule`

## Architecture Patterns

- **Layered architecture**: Routes → Services → Repositories → Database
- **Repository pattern**: All database queries go through repository classes
- **Multi-tenant**: Organization context injected via JWT middleware
- **JWT authentication**: Stateless auth with organization isolation

## Key Conventions

- All backend code uses TypeScript with strict mode
- API routes are organized by resource (auth, staff, patients, schedules, etc.)
- Prisma schema is the source of truth for database structure
- Frontend stores handle API calls and state management
- Use existing patterns when adding new features

## Testing

Backend tests use Vitest. Run `npm run test:run` from `/backend` to execute.

**Important**: When writing tests that use Prisma model fields with enum types (e.g., `RuleCategory`, `Gender`, `Status`), always import and use the enum from `@prisma/client` instead of string literals. Using string literals will cause TypeScript build errors.

```typescript
// ❌ Wrong - causes TS2345 error
const rule = { category: 'gender_pairing', ... }

// ✅ Correct - import and use the enum
import { RuleCategory } from '@prisma/client'
const rule = { category: RuleCategory.gender_pairing, ... }
```

## Database Schema

See `/backend/prisma/schema.prisma` for the complete data model. Key entities:

- Organization (tenant)
- User (authentication)
- Staff (therapists)
- Patient
- Room
- Schedule, ScheduleSession
- SchedulingRule

## User Roles

- **Superadmin**: Can add and manage organizations and change context to any organization
- **Administrator**: Belongs to an organization and can perform all managements tasks within that organization
- **Staff**: Belongs to an organization and can view schedules and update personal information and availability
