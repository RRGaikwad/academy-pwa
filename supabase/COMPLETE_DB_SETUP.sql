-- =============================================================================
-- ULTIMATE FIX: RUN THIS IN SUPABASE → SQL Editor → Run
-- This script:
-- 1. Creates all missing tables
-- 2. Ensures every Auth user has a Profile
-- 3. Grants absolute access to Admins (bypassing RLS)
-- 4. Fixes the "missing records" issue
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

-- 2. Ensure every Auth user has a profile (Fixes login issues)
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin' -- Defaulting to admin for the person running the script
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable RLS and setup permissive policies for Admins
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
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() AND lower(role) = ''admin''
                )
            )
        ', t);
    END LOOP;
END $$;

-- 5. Standard Read Access for Everyone (Announcements, Profiles, Batches)
CREATE POLICY "Everyone can view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Everyone can view batches" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Everyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- 6. Students can view their own specific data
CREATE POLICY "Students view own record" ON public.students FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Students view own results" ON public.exam_results FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Students view own fees" ON public.fee_payments FOR SELECT TO authenticated USING (auth.uid() = student_id);

-- 7. Teachers can view their own record
CREATE POLICY "Teachers view own record" ON public.teachers FOR SELECT TO authenticated USING (auth.uid() = id);
