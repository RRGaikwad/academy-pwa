-- =============================================================================
-- ULTIMATE ADMIN AUTH & PERMISSIONS FIX (v6.0 - THE FINAL RECURSION FIX)
-- RUN THIS IN SUPABASE → SQL Editor → Run
-- This script fixes the "0 records" issue by breaking RLS recursion on the profiles table.
-- =============================================================================

-- 1. Ensure password column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;

-- 2. CREATE A SECURITY DEFINER ROLE GETTER
-- This is the key to breaking RLS recursion. 
-- SECURITY DEFINER means this function runs with database owner privileges,
-- bypassing RLS when it reads the profiles table.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role::text FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- 3. Fix Profile Lookup RPC (For Login)
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

-- 4. APPLY BULLETPROOF POLICIES (Recursion-Free)
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
        
        -- The Core Admin Policy: Uses the get_auth_role() function to avoid recursion
        EXECUTE format('
            CREATE POLICY "Admin Full Access v6" ON public.%I
            FOR ALL TO authenticated
            USING (public.get_auth_role() = ''admin'')
            WITH CHECK (public.get_auth_role() = ''admin'')
        ', t);

        -- Self-Access Policies for non-admins (so they can see their own data)
        IF t = 'profiles' THEN
            EXECUTE format('CREATE POLICY "User View Own Profile v6" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'students' THEN
            EXECUTE format('CREATE POLICY "Student View Own Record v6" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        ELSIF t = 'teachers' THEN
            EXECUTE format('CREATE POLICY "Teacher View Own Record v6" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = id)', t);
        END IF;
    END LOOP;
END $$;

-- 5. Public Read for Essential Skeleton Data (Authenticated Only)
-- This ensures the UI doesn't look empty while the role is being verified.
CREATE POLICY "Public View Announcements v6" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public View Batches v6" ON public.batches FOR SELECT TO authenticated USING (true);

-- 6. Ensure Master Admin is correctly set in profiles
-- This matches the user in your screenshot
INSERT INTO public.profiles (id, email, role, name)
SELECT 
    id, 
    email, 
    'admin',
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Master Admin')
FROM auth.users
WHERE email = 'admin@rohan.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', name = 'Master Admin';

-- 7. Fix Realtime Replication
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'profiles', 'students', 'teachers', 'batches', 
        'announcements', 'exams', 'attendance', 
        'fee_payments', 'study_materials', 'exam_results'
    ];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END $$;

-- 8. Final Permissions
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_for_login(text) TO anon, authenticated;
