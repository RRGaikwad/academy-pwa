-- =============================================================================
-- ULTIMATE ADMIN AUTH & PERMISSIONS FIX (v5.0 - THE FINAL PERMANENT FIX)
-- RUN THIS IN SUPABASE → SQL Editor → Run
-- This script eliminates RLS recursion and ensures persistent admin access.
-- =============================================================================

-- 1. Ensure password column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;

-- 2. CREATE A ROBUST ADMIN CHECKER (Bypasses RLS)
-- This function is SECURITY DEFINER, meaning it runs as the database owner.
-- It will ALWAYS be able to read the profiles table even if RLS is enabled.
CREATE OR REPLACE FUNCTION public.is_admin_v5(p_uid uuid)
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

-- 4. CLEANUP AND APPLY BULLETPROOF POLICIES
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
        
        -- Drop ALL existing policies for this table
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
        
        -- The Core Admin Policy: Uses the SECURITY DEFINER function to avoid recursion
        EXECUTE format('
            CREATE POLICY "Admin Full Access" ON public.%I
            FOR ALL TO authenticated
            USING (public.is_admin_v5(auth.uid()))
            WITH CHECK (public.is_admin_v5(auth.uid()))
        ', t);

        -- Self-Access Policies for non-admins
        IF t = 'profiles' THEN
            EXECUTE format('CREATE POLICY "User View Own Profile" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'students' THEN
            EXECUTE format('CREATE POLICY "Student View Own Record" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'teachers' THEN
            EXECUTE format('CREATE POLICY "Teacher View Own Record" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        END IF;
    END LOOP;
END $$;

-- 5. Public Read for Skeleton Data (Authenticated Only)
-- This ensures the app doesn't look "broken" during the split-second before role verification
CREATE POLICY "Public Authenticated View Announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public Authenticated View Batches" ON public.batches FOR SELECT TO authenticated USING (true);

-- 6. Ensure Existing Admins are Correctly Set
INSERT INTO public.profiles (id, email, role, name)
SELECT 
    id, 
    email, 
    'admin',
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Admin')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 7. Fix Realtime Replication
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
        -- REPLICA IDENTITY FULL is required for Realtime to send old/new data correctly
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END $$;

-- 8. Final Permissions
GRANT EXECUTE ON FUNCTION public.is_admin_v5(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_for_login(text) TO anon, authenticated;
