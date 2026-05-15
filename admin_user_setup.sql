-- =====================================================
-- STEP 1: Run this AFTER running supabase_migration.sql
-- Creates a demo admin user for login
-- Email: admin@sengol.com
-- Password: Admin@123456
-- =====================================================

-- Create admin user in Supabase auth
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@sengol.com',
  crypt('Admin@123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"admin","full_name":"Admin User"}',
  now(),
  now(),
  '', '', '', ''
) ON CONFLICT (email) DO NOTHING;

-- The trigger will auto-create the profile with role='admin'
-- Verify: SELECT * FROM profiles;
