-- CBD Intake Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR NOT EXISTS (SELECT 1 FROM public.profiles) -- Allow first user
    );

CREATE POLICY "Admins can delete profiles" ON public.profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- CONSIGNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.consigners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    number TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.consigners ENABLE ROW LEVEL SECURITY;

-- Policies for consigners (all authenticated users can CRUD)
CREATE POLICY "Authenticated users can view consigners" ON public.consigners
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert consigners" ON public.consigners
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update consigners" ON public.consigners
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete consigners" ON public.consigners
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Index for searching
CREATE INDEX idx_consigners_name ON public.consigners(name);
CREATE INDEX idx_consigners_number ON public.consigners(number);

-- ============================================
-- FORMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.forms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Consigner info (denormalized for historical accuracy)
    consigner_type TEXT NOT NULL CHECK (consigner_type IN ('new', 'existing')),
    consigner_name TEXT NOT NULL,
    consigner_number TEXT,
    consigner_address TEXT,
    consigner_phone TEXT,
    consigner_email TEXT,
    
    -- Form metadata
    intake_mode TEXT CHECK (intake_mode IN ('detection', 'general', 'email')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
    
    -- Items stored as JSONB array
    items JSONB DEFAULT '[]'::jsonb,
    
    -- Field configuration
    enabled_fields JSONB,
    
    -- Signature data
    signature_data TEXT,
    initials_1 TEXT,
    initials_2 TEXT,
    initials_3 TEXT,
    accepted_by TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    signed_at TIMESTAMPTZ,
    
    -- User tracking
    created_by UUID REFERENCES auth.users(id),
    signed_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- Policies for forms
CREATE POLICY "Authenticated users can view forms" ON public.forms
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert forms" ON public.forms
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own draft forms" ON public.forms
    FOR UPDATE USING (
        auth.role() = 'authenticated' 
        AND (status = 'draft' OR created_by = auth.uid())
    );

CREATE POLICY "Admins can delete forms" ON public.forms
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Indexes for searching
CREATE INDEX idx_forms_consigner_name ON public.forms(consigner_name);
CREATE INDEX idx_forms_consigner_number ON public.forms(consigner_number);
CREATE INDEX idx_forms_status ON public.forms(status);
CREATE INDEX idx_forms_created_at ON public.forms(created_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_consigners_updated_at
    BEFORE UPDATE ON public.consigners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_forms_updated_at
    BEFORE UPDATE ON public.forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- INITIAL ADMIN USER
-- ============================================
-- Note: Create your first admin user through Supabase Auth,
-- then run this to make them admin:
-- UPDATE public.profiles SET role = 'admin' WHERE username = 'admin';


