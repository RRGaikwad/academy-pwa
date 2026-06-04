-- =============================================================================
-- ULTIMATE ADMIN AUTH & PERMISSIONS FIX
-- RUN THIS IN SUPABASE → SQL Editor → Run
-- This script fixes the "Account not found" and "Incorrect password" issues for admins.
-- =============================================================================

-- 1. Ensure password column exists in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;

-- 2. Fix Profile Lookup RPC (Bypasses RLS for login)
CREATE OR REPLACE FUNCTION public.lookup_profile_for_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'role', lower(coalesce(v_profile.role::text, '')),
    'password', v_profile.password
  );
END;
$$;

-- 3. Fix Academy User Authentication RPC (Handles Admin/Student/Teacher)
CREATE OR REPLACE FUNCTION public.authenticate_academy_user(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_teacher public.teachers%ROWTYPE;
  v_input text := trim(coalesce(p_password, ''));
BEGIN
  IF v_input = '' THEN
    RETURN NULL;
  END IF;

  -- Find the profile first
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- ADMIN CASE: Check profiles.password
  IF lower(coalesce(v_profile.role::text, '')) = 'admin' THEN
    IF trim(coalesce(v_profile.password, '')) = v_input THEN
      RETURN jsonb_build_object(
        'id', v_profile.id,
        'name', v_profile.name,
        'email', v_profile.email,
        'phone', v_profile.phone,
        'role', 'admin'
      );
    END IF;
    RETURN NULL;
  END IF;

  -- STUDENT CASE
  IF lower(coalesce(v_profile.role::text, '')) = 'student' THEN
    SELECT * INTO v_student FROM public.students WHERE id = v_profile.id;
    IF FOUND AND (trim(coalesce(v_student.password, '')) = v_input OR trim(coalesce(v_profile.password, '')) = v_input) THEN
      RETURN jsonb_build_object(
        'id', v_profile.id,
        'name', v_profile.name,
        'email', v_profile.email,
        'role', 'student',
        'student_id', v_student.student_id
      );
    END IF;
  END IF;

  -- TEACHER CASE
  IF lower(coalesce(v_profile.role::text, '')) = 'teacher' THEN
    SELECT * INTO v_teacher FROM public.teachers WHERE id = v_profile.id;
    IF FOUND AND (trim(coalesce(v_teacher.password, '')) = v_input OR trim(coalesce(v_profile.password, '')) = v_input) THEN
      RETURN jsonb_build_object(
        'id', v_profile.id,
        'name', v_profile.name,
        'email', v_profile.email,
        'role', 'teacher',
        'teacher_id', v_teacher.teacher_id
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 4. Ensure is_admin() helper is correct
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND lower(role::text) = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant absolute access to admins for all tables
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'profiles', 'students', 'teachers', 'batches', 
        'announcements', 'exams', 'attendance', 
        'fee_payments', 'study_materials', 'exam_results'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON public.%I', t);
        EXECUTE format('
            CREATE POLICY "Admins have full access" ON public.%I
            FOR ALL TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin())
        ', t);
    END LOOP;
END $$;

-- 6. Fix for existing admins: ensure they have a profile
-- We use COALESCE to provide a default name 'Admin' to satisfy NOT NULL constraints
INSERT INTO public.profiles (id, email, role, name)
SELECT 
    id, 
    email, 
    'admin',
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Admin')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
    role = 'admin',
    name = COALESCE(public.profiles.name, EXCLUDED.name);

-- 7. Fix trigger to satisfy NOT NULL name (if it exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, name)
  VALUES (
    new.id, 
    new.email, 
    'student', 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Optional: Make name nullable if you prefer it not to be mandatory
ALTER TABLE public.profiles ALTER COLUMN name DROP NOT NULL;

-- 9. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.lookup_profile_for_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_academy_user(text, text) TO anon, authenticated;

-- =============================================================================
-- MANUAL STEP (Run if you still can't log in):
-- Replace 'your-email@example.com' and 'your-password' with your real info.
-- =============================================================================
-- UPDATE public.profiles 
-- SET role = 'admin', password = 'your-password' 
-- WHERE email = 'your-email@example.com';
