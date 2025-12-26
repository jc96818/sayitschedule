-- Say It Schedule Database Initialization Script
-- Run this script to create the database and initial schema

-- Create database (run as superuser)
-- CREATE DATABASE sayitschedule;

-- Connect to the database
-- \c sayitschedule

-- Create enums
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'admin_assistant', 'staff');
CREATE TYPE gender AS ENUM ('male', 'female', 'other');
CREATE TYPE status AS ENUM ('active', 'inactive');
CREATE TYPE schedule_status AS ENUM ('draft', 'published');
CREATE TYPE rule_category AS ENUM ('gender_pairing', 'session', 'availability', 'specific_pairing', 'certification');

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(63) NOT NULL UNIQUE,
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#2563eb',
    secondary_color VARCHAR(7) DEFAULT '#1e40af',
    status status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_login TIMESTAMP
);

-- Staff table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    gender gender NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    certifications JSONB DEFAULT '[]',
    default_hours JSONB,
    status status DEFAULT 'active' NOT NULL,
    hire_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(50),
    gender gender NOT NULL,
    session_frequency INTEGER NOT NULL DEFAULT 2,
    preferred_times JSONB,
    required_certifications JSONB DEFAULT '[]',
    notes TEXT,
    status status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Rules table
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    category rule_category NOT NULL,
    description TEXT NOT NULL,
    rule_logic JSONB NOT NULL,
    priority INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_by UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Schedules table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    week_start_date TIMESTAMP NOT NULL,
    status schedule_status DEFAULT 'draft' NOT NULL,
    created_by UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    published_at TIMESTAMP,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES schedules(id) NOT NULL,
    therapist_id UUID REFERENCES staff(id) NOT NULL,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    date TIMESTAMP NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Staff Availability table
CREATE TABLE staff_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id) NOT NULL,
    date TIMESTAMP NOT NULL,
    available BOOLEAN DEFAULT true NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    reason TEXT
);

-- Audit Logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    changes JSONB,
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Federal Holidays table
CREATE TABLE federal_holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    date TIMESTAMP NOT NULL
);

-- Custom Holidays table
CREATE TABLE custom_holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name VARCHAR(100) NOT NULL,
    date TIMESTAMP NOT NULL,
    reason TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_staff_organization ON staff(organization_id);
CREATE INDEX idx_patients_organization ON patients(organization_id);
CREATE INDEX idx_rules_organization ON rules(organization_id);
CREATE INDEX idx_schedules_organization ON schedules(organization_id);
CREATE INDEX idx_schedules_week ON schedules(week_start_date);
CREATE INDEX idx_sessions_schedule ON sessions(schedule_id);
CREATE INDEX idx_sessions_therapist ON sessions(therapist_id);
CREATE INDEX idx_sessions_patient ON sessions(patient_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_staff_availability_staff ON staff_availability(staff_id);
CREATE INDEX idx_staff_availability_date ON staff_availability(date);
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Insert 2025 Federal Holidays
INSERT INTO federal_holidays (year, name, date) VALUES
(2025, 'New Year''s Day', '2025-01-01'),
(2025, 'Martin Luther King Jr. Day', '2025-01-20'),
(2025, 'Presidents'' Day', '2025-02-17'),
(2025, 'Memorial Day', '2025-05-26'),
(2025, 'Juneteenth', '2025-06-19'),
(2025, 'Independence Day', '2025-07-04'),
(2025, 'Labor Day', '2025-09-01'),
(2025, 'Columbus Day', '2025-10-13'),
(2025, 'Veterans Day', '2025-11-11'),
(2025, 'Thanksgiving Day', '2025-11-27'),
(2025, 'Christmas Day', '2025-12-25');
