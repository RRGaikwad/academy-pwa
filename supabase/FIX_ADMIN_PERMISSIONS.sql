-- =============================================================================
-- RUN THIS IN SUPABASE → SQL Editor → Run
-- This script ensures the Admin role has full access to all academy tables
-- =============================================================================

-- 1. Enable RLS on all tables (if not already)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- 2. Create a helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role::text = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant full access to admins for all tables
-- We use a loop or individual statements for each table

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
        -- Drop existing admin policy if any
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON public.%I', t);
        
        -- Create new policy
        EXECUTE format('
            CREATE POLICY "Admins have full access" ON public.%I
            FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin())
        ', t);
    END LOOP;
END $$;

-- 4. Ensure everyone can see announcements (optional, but common)
DROP POLICY IF EXISTS "Everyone can view announcements" ON public.announcements;
CREATE POLICY "Everyone can view announcements" ON public.announcements
    FOR SELECT TO authenticated USING (true);

-- 5. Students can see their own data
DROP POLICY IF EXISTS "Students can view own profile" ON public.profiles;
CREATE POLICY "Students can view own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Students can view own metadata" ON public.students;
CREATE POLICY "Students can view own metadata" ON public.students
    FOR SELECT TO authenticated USING (auth.uid() = id);

-- 6. Teachers can see their own data
DROP POLICY IF EXISTS "Teachers can view own profile" ON public.profiles;
CREATE POLICY "Teachers can view own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Teachers can view own metadata" ON public.teachers;
CREATE POLICY "Teachers can view own metadata" ON public.teachers
    FOR SELECT TO authenticated USING (auth.uid() = id);
