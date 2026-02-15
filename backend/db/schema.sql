-- Users table (replaces Supabase auth + profiles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY,
    consigner_type VARCHAR(20) NOT NULL,
    consigner_name VARCHAR(255) NOT NULL DEFAULT '',
    consigner_number VARCHAR(50),
    consigner_address TEXT,
    consigner_phone VARCHAR(50),
    consigner_email VARCHAR(255),
    intake_mode VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    items JSONB DEFAULT '[]'::jsonb,
    enabled_fields JSONB,
    signature_data TEXT,
    initials_1 VARCHAR(10),
    initials_2 VARCHAR(10),
    initials_3 VARCHAR(10),
    signature_date VARCHAR(20),
    accepted_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Consigners table
CREATE TABLE IF NOT EXISTS consigners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    number VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deleted forms tracking (for sync pull)
CREATE TABLE IF NOT EXISTS deleted_forms (
    id UUID PRIMARY KEY,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forms_updated_at ON forms(updated_at);
CREATE INDEX IF NOT EXISTS idx_forms_consigner_number ON forms(consigner_number);
CREATE INDEX IF NOT EXISTS idx_consigners_number ON consigners(number);
CREATE INDEX IF NOT EXISTS idx_consigners_name ON consigners(name);
CREATE INDEX IF NOT EXISTS idx_deleted_forms_deleted_at ON deleted_forms(deleted_at);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_consigners_updated_at BEFORE UPDATE ON consigners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
