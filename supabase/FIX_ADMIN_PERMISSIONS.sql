-- =============================================================================
-- ULTIMATE ADMIN AUTH & PERMISSIONS FIX (v2 - PERSISTENCE & REALTIME)
-- RUN THIS IN SUPABASE → SQL Editor → Run
-- =============================================================================

-- 1. Ensure password column exists in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;

-- 2. Fix Profile Lookup RPC
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

-- 3. Fix Academy User Authentication RPC
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

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- ADMIN CASE
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

-- 4. Grant absolute access to admins for all tables
-- We use a subquery in USING/WITH CHECK to ensure the role is checked directly against the profiles table
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
            USING (
                COALESCE((SELECT lower(role::text) FROM public.profiles WHERE id = auth.uid()), '''') = ''admin''
            )
            WITH CHECK (
                COALESCE((SELECT lower(role::text) FROM public.profiles WHERE id = auth.uid()), '''') = ''admin''
            )
        ', t);
    END LOOP;
END $$;

-- 5. Fix for existing admins: ensure they have a profile
INSERT INTO public.profiles (id, email, role, name)
SELECT 
    id, 
    email, 
    'admin',
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Admin')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 6. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.lookup_profile_for_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_academy_user(text, text) TO anon, authenticated;

-- 7. Enable Realtime for all tables
-- This ensures that changes made by one role are instantly seen by others
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'profiles', 'students', 'teachers', 'batches', 
        'announcements', 'exams', 'attendance', 
        'fee_payments', 'study_materials', 'exam_results'
    ];
BEGIN
    -- Create publication if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add each table to publication individually, ignoring errors if already present
    FOREACH t IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table is already in publication, do nothing
                NULL;
            WHEN OTHERS THEN
                -- Other errors, just log or ignore
                RAISE NOTICE 'Could not add table % to realtime publication: %', t, SQLERRM;
        END;
    END LOOP;
END $$;

-- 8. Standard Read Access for Everyone (Announcements, Profiles, Batches)
-- These are necessary for initial state load
DROP POLICY IF EXISTS "Everyone can view announcements" ON public.announcements;
CREATE POLICY "Everyone can view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view batches" ON public.batches;
CREATE POLICY "Everyone can view batches" ON public.batches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;
CREATE POLICY "Everyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
