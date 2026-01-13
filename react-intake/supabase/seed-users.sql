-- ===========================================
-- CBD Intake: Create Test Users
-- Run this in Supabase SQL Editor
-- ===========================================

-- First, delete existing test users if they exist
DELETE FROM auth.users WHERE email IN ('admin@cbd.com', 'staff@cbd.com');

-- Create admin user (Password: admin123)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@cbd.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "admin", "display_name": "Administrator", "role": "admin"}',
  'authenticated',
  'authenticated'
);

-- Create staff user (Password: staff123)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'staff@cbd.com',
  crypt('staff123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "staff", "display_name": "Staff Member", "role": "staff"}',
  'authenticated',
  'authenticated'
);

-- ===========================================
-- To change a user's password, run:
-- ===========================================
-- UPDATE auth.users 
-- SET encrypted_password = crypt('NEW_PASSWORD_HERE', gen_salt('bf'))
-- WHERE email = 'admin@cbd.com';

-- ===========================================
-- To delete a user:
-- ===========================================
-- DELETE FROM auth.users WHERE email = 'admin@cbd.com';

-- ===========================================
-- View all users:
-- ===========================================
-- SELECT id, email, raw_user_meta_data->>'display_name' as name, 
--        raw_user_meta_data->>'role' as role, created_at 
-- FROM auth.users;
