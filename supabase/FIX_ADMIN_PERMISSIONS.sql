-- =============================================================================
-- ULTIMATE ADMIN AUTH & PERMISSIONS FIX (v4 - THE ONE-SHOT FIX)
-- RUN THIS IN SUPABASE → SQL Editor → Run
-- =============================================================================

-- 1. Ensure password column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;

-- 2. CREATE SECURITY DEFINER ADMIN CHECKER
-- This function bypasses RLS to check roles, preventing infinite recursion.
CREATE OR REPLACE FUNCTION public.check_is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid AND lower(role::text) = 'admin'
  );
END;
$$;

-- 3. Fix Profile Lookup RPC
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

-- 4. Fix Academy User Authentication RPC
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

-- 5. APPLY BULLETPROOF POLICIES
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
        EXECUTE format('DROP POLICY IF EXISTS "Public read for authenticated" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Self read" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Self read student" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Self read teacher" ON public.%I', t);
        
        -- Admin Access Policy
        EXECUTE format('
            CREATE POLICY "Admins have full access" ON public.%I
            FOR ALL TO authenticated
            USING (public.check_is_admin(auth.uid()))
            WITH CHECK (public.check_is_admin(auth.uid()))
        ', t);

        -- Self Read Policy for non-admins
        IF t = 'profiles' THEN
            EXECUTE format('CREATE POLICY "Self read" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'students' THEN
            EXECUTE format('CREATE POLICY "Self read student" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'teachers' THEN
            EXECUTE format('CREATE POLICY "Self read teacher" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        END IF;
    END LOOP;
END $$;

-- 6. Public Read for essential tables (to ensure app loads)
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read batches" ON public.batches;
CREATE POLICY "Public read batches" ON public.batches FOR SELECT TO authenticated USING (true);

-- 7. Fix for existing admins
INSERT INTO public.profiles (id, email, role, name)
SELECT 
    id, 
    email, 
    'admin',
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Admin')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 8. Enable Realtime with Bulletproof Configuration
-- 1. Create publication if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Set Replica Identity to FULL for all tables and add them to the publication
-- This ensures that Realtime can track changes even for tables with complex structures
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
        -- Set replica identity to FULL so that all column changes are broadcasted
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
        
        -- Add to publication, ignoring errors if already present
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END $$;

-- 9. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.check_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_for_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_academy_user(text, text) TO anon, authenticated;
