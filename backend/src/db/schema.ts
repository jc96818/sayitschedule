import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'admin_assistant', 'staff'])
export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])
export const statusEnum = pgEnum('status', ['active', 'inactive'])
export const scheduleStatusEnum = pgEnum('schedule_status', ['draft', 'published'])
export const ruleCategoryEnum = pgEnum('rule_category', [
  'gender_pairing',
  'session',
  'availability',
  'specific_pairing',
  'certification'
])

// Organizations
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 63 }).notNull().unique(),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#2563eb'),
  secondaryColor: varchar('secondary_color', { length: 7 }).default('#1e40af'),
  status: statusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLogin: timestamp('last_login')
})

// Staff
export const staff = pgTable('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  gender: genderEnum('gender').notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  certifications: jsonb('certifications').$type<string[]>().default([]),
  defaultHours: jsonb('default_hours').$type<Record<string, { start: string; end: string } | null>>(),
  status: statusEnum('status').default('active').notNull(),
  hireDate: timestamp('hire_date'),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

// Patients
export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  identifier: varchar('identifier', { length: 50 }),
  gender: genderEnum('gender').notNull(),
  sessionFrequency: integer('session_frequency').notNull().default(2),
  preferredTimes: jsonb('preferred_times').$type<string[]>(),
  requiredCertifications: jsonb('required_certifications').$type<string[]>().default([]),
  preferredRoomId: uuid('preferred_room_id'),
  requiredRoomCapabilities: jsonb('required_room_capabilities').$type<string[]>().default([]),
  notes: text('notes'),
  status: statusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

// Rules
export const rules = pgTable('rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  category: ruleCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  ruleLogic: jsonb('rule_logic').$type<Record<string, unknown>>().notNull(),
  priority: integer('priority').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Rooms
export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  capabilities: jsonb('capabilities').$type<string[]>().default([]),
  description: text('description'),
  status: statusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Schedules
export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  weekStartDate: timestamp('week_start_date').notNull(),
  status: scheduleStatusEnum('status').default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
  version: integer('version').default(1).notNull()
})

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').references(() => schedules.id).notNull(),
  therapistId: uuid('therapist_id').references(() => staff.id).notNull(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  roomId: uuid('room_id').references(() => rooms.id),
  date: timestamp('date').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:mm format
  endTime: varchar('end_time', { length: 5 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

// Staff Availability
export const staffAvailability = pgTable('staff_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').references(() => staff.id).notNull(),
  date: timestamp('date').notNull(),
  available: boolean('available').default(true).notNull(),
  startTime: varchar('start_time', { length: 5 }),
  endTime: varchar('end_time', { length: 5 }),
  reason: text('reason')
})

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>(),
  timestamp: timestamp('timestamp').defaultNow().notNull()
})

// Federal Holidays
export const federalHolidays = pgTable('federal_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  year: integer('year').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  date: timestamp('date').notNull()
})

// Custom Holidays (per organization)
export const customHolidays = pgTable('custom_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  date: timestamp('date').notNull(),
  reason: text('reason')
})
