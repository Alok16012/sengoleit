-- =====================================================
-- FIX: Run this in Supabase SQL Editor
-- Fixes the trigger and creates admin user
-- =====================================================

-- Step 1: Fix the profiles INSERT policy (allow trigger to insert)
DROP POLICY IF EXISTS "Allow insert on signup" ON profiles;
CREATE POLICY "Allow insert on signup" ON profiles
  FOR INSERT WITH CHECK (true);

-- Step 2: Fix the trigger function (bypass RLS properly)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'center'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 4: Create admin user directly (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@sengol.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'admin@sengol.com',
      crypt('Admin@123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"admin","full_name":"Admin User"}',
      now(), now(), '', '', '', ''
    );
  END IF;
END $$;

-- Step 5: Make sure profile exists for admin
INSERT INTO public.profiles (id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@sengol.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Verify
SELECT u.email, p.role
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'admin@sengol.com';
