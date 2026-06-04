-- =============================================================================
-- COMPREHENSIVE FIX: RUN THIS IN SUPABASE → SQL Editor → Run
-- This script creates missing tables and ensures Admin has full access.
-- =============================================================================

-- 1. Create Tables if they don't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    role TEXT DEFAULT 'student',
    password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id TEXT UNIQUE,
    batch_id TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    category TEXT,
    stream TEXT,
    subjects TEXT[],
    admission_date TEXT,
    total_fees NUMERIC DEFAULT 0,
    paid_fees NUMERIC DEFAULT 0,
    attendance_percent NUMERIC DEFAULT 0,
    performance_score NUMERIC DEFAULT 0,
    notes TEXT,
    password TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_id TEXT UNIQUE,
    subject TEXT,
    assigned_categories TEXT[],
    permissions TEXT[],
    password TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    category TEXT,
    stream TEXT,
    teacher_ids UUID[],
    student_ids UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    content TEXT,
    author_id UUID REFERENCES public.profiles(id),
    author_name TEXT,
    target_role TEXT,
    target_batch TEXT,
    type TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    subject TEXT,
    batch_id TEXT,
    teacher_id UUID REFERENCES public.profiles(id),
    duration NUMERIC,
    questions JSONB,
    scheduled_at TEXT,
    status TEXT DEFAULT 'upcoming',
    chapter_tags TEXT[],
    has_negative_marking BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT,
    teacher_id UUID REFERENCES public.profiles(id),
    date TEXT,
    subject TEXT,
    records JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id),
    amount NUMERIC,
    date TEXT,
    mode TEXT,
    receipt_no TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    subject TEXT,
    batch_id TEXT,
    teacher_id UUID REFERENCES public.profiles(id),
    file_url TEXT,
    file_name TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    answers INTEGER[],
    score NUMERIC,
    total_marks NUMERIC,
    accuracy NUMERIC,
    rank NUMERIC,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    weak_chapters TEXT[]
);

-- 2. Enable RLS on all tables
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
    END LOOP;
END $$;

-- 3. Create helper function for Admin check
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

-- 4. Set up Policies for Admins (Full Access)
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
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON public.%I', t);
        EXECUTE format('
            CREATE POLICY "Admins have full access" ON public.%I
            FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin())
        ', t);
    END LOOP;
END $$;

-- 5. Standard Read Access for Students & Teachers
DROP POLICY IF EXISTS "Everyone can view announcements" ON public.announcements;
CREATE POLICY "Everyone can view announcements" ON public.announcements
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view batches" ON public.batches;
CREATE POLICY "Everyone can view batches" ON public.batches
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

-- 6. Ensure everyone can see profiles (needed for name lookups in app)
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;
CREATE POLICY "Everyone can view profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);
