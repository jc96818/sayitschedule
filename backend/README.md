# Say It Schedule - Backend

Fastify + TypeScript backend API with PostgreSQL database using Drizzle ORM.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose (for local database)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Database

From the project root:

```bash
docker-compose up -d db
```

### 3. Set Up Environment Variables

```bash
cp ../.env.example ../.env
```

Edit `.env` as needed. Default values work for local development.

### 4. Run Database Migrations

```bash
# Push schema directly to database (recommended for development)
npx drizzle-kit push:pg

# Or with explicit DATABASE_URL
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/sayitschedule" npx drizzle-kit push:pg
```

### 5. Start the Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## Database Commands

### Drizzle Kit Commands

| Command | Description |
|---------|-------------|
| `npx drizzle-kit push:pg` | Push schema directly to database (dev) |
| `npx drizzle-kit generate:pg` | Generate SQL migration files from schema |
| `npx drizzle-kit drop` | Drop a migration file |
| `npx drizzle-kit studio` | Open Drizzle Studio GUI |

### Common Workflows

**Development (quick iteration):**
```bash
# After modifying src/db/schema.ts
npx drizzle-kit push:pg
```

**Production (versioned migrations):**
```bash
# Generate migration file
npx drizzle-kit generate:pg

# Review generated SQL in ./drizzle folder
# Then apply in production environment
```

### Direct Database Access

```bash
# Connect to PostgreSQL via Docker
docker exec -it sayitschedule-db psql -U postgres -d sayitschedule

# List all tables
\dt

# Describe a table
\d users

# Exit
\q
```

## Project Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── index.ts        # Database connection
│   │   └── schema.ts       # Drizzle schema definitions
│   ├── middleware/
│   │   └── auth.ts         # JWT authentication & RBAC
│   ├── repositories/       # Data access layer
│   │   ├── base.ts         # Pagination utilities
│   │   ├── audit.ts        # Audit logging
│   │   ├── organizations.ts
│   │   ├── users.ts
│   │   ├── staff.ts
│   │   ├── patients.ts
│   │   ├── rules.ts
│   │   └── schedules.ts
│   ├── routes/             # API endpoints
│   │   ├── auth.ts
│   │   ├── organizations.ts
│   │   ├── users.ts
│   │   ├── staff.ts
│   │   ├── patients.ts
│   │   ├── rules.ts
│   │   └── schedules.ts
│   └── index.ts            # App entry point
├── drizzle/                # Generated migration files
├── drizzle.config.ts       # Drizzle Kit configuration
├── package.json
└── tsconfig.json
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Organizations (Super Admin)
- `GET /api/organizations` - List all organizations
- `GET /api/organizations/:id` - Get organization details
- `POST /api/organizations` - Create organization
- `PUT /api/organizations/:id` - Update organization
- `POST /api/organizations/:id/switch` - Switch org context

### Users (Admin)
- `GET /api/users` - List users in organization
- `GET /api/users/:id` - Get user details
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Staff (Admin/Assistant)
- `GET /api/staff` - List staff members
- `GET /api/staff/:id` - Get staff details
- `POST /api/staff` - Create staff member
- `PUT /api/staff/:id` - Update staff member
- `DELETE /api/staff/:id` - Delete staff member

### Patients (Admin/Assistant)
- `GET /api/patients` - List patients
- `GET /api/patients/:id` - Get patient details
- `POST /api/patients` - Create patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Rules (Admin/Assistant)
- `GET /api/rules` - List scheduling rules
- `GET /api/rules/:id` - Get rule details
- `POST /api/rules` - Create rule
- `PUT /api/rules/:id` - Update rule
- `POST /api/rules/:id/toggle` - Toggle rule active status
- `DELETE /api/rules/:id` - Delete rule
- `POST /api/rules/parse-voice` - Parse voice input for rule creation

### Schedules (Admin/Assistant)
- `GET /api/schedules` - List schedules
- `GET /api/schedules/:id` - Get schedule with sessions
- `POST /api/schedules/generate` - Generate new schedule
- `POST /api/schedules/:id/publish` - Publish schedule
- `POST /api/schedules/:id/archive` - Archive schedule
- `POST /api/schedules/:id/sessions` - Add session
- `PUT /api/schedules/:id/sessions/:sessionId` - Update session
- `DELETE /api/schedules/:id/sessions/:sessionId` - Delete session
- `GET /api/schedules/:id/export/pdf` - Export as PDF

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5433/sayitschedule` |
| `JWT_SECRET` | Secret for JWT signing | Required |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
