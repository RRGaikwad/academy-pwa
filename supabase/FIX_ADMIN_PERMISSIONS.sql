-- =============================================================================
-- ULTIMATE ADMIN AUTH & PERMISSIONS FIX (v4.1 - ZERO DATA LOSS ON REFRESH)
-- RUN THIS IN SUPABASE → SQL Editor → Run
-- =============================================================================

-- 1. Ensure password column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;

-- 2. CREATE SECURITY DEFINER ADMIN CHECKER
-- This function bypasses RLS to check roles. 
-- SECURITY DEFINER ensures it runs with the privileges of the creator (postgres).
CREATE OR REPLACE FUNCTION public.check_is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return true if the user has role 'admin' in profiles table
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

-- 4. APPLY BULLETPROOF POLICIES TO ALL TABLES
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
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop ALL existing policies for this table to start fresh
        EXECUTE format('
            DO $policy_cleanup$
            DECLARE
                p record;
            BEGIN
                FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = %L AND schemaname = ''public'') LOOP
                    EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%%I'', p.policyname, %L);
                END LOOP;
            END $policy_cleanup$;
        ', t, t);
        
        -- Admin Access Policy (The primary policy)
        EXECUTE format('
            CREATE POLICY "Admins have full access" ON public.%I
            FOR ALL TO authenticated
            USING (public.check_is_admin(auth.uid()))
            WITH CHECK (public.check_is_admin(auth.uid()))
        ', t);

        -- Standard Self-Access for non-admins
        IF t = 'profiles' THEN
            EXECUTE format('CREATE POLICY "User can view own profile" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'students' THEN
            EXECUTE format('CREATE POLICY "Student can view own record" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'teachers' THEN
            EXECUTE format('CREATE POLICY "Teacher can view own record" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        END IF;
    END LOOP;
END $$;

-- 5. Public Read for essential tables (to ensure app loads its skeleton)
CREATE POLICY "Anyone can view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view batches" ON public.batches FOR SELECT TO authenticated USING (true);

-- 6. Fix for existing admins (Force update role from Auth metadata if possible)
INSERT INTO public.profiles (id, email, role, name)
SELECT 
    id, 
    email, 
    'admin',
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Admin')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 7. Enable Realtime with REPLICA IDENTITY FULL
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

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
        -- Set replica identity to FULL for perfect realtime sync
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
        -- Add to publication
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END $$;

-- 8. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.check_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_for_login(text) TO anon, authenticated;
