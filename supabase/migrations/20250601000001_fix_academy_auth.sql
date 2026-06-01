-- Run this in Supabase SQL Editor AFTER the first auth migration (or instead — it is safe to re-run).

-- 1. Ensure password columns exist (login fails if these are missing)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS password text;

-- 2. Backfill profiles.password from students/teachers for existing accounts
UPDATE public.profiles p
SET password = s.password
FROM public.students s
WHERE p.id = s.id
  AND s.password IS NOT NULL
  AND (p.password IS NULL OR p.password = '');

UPDATE public.profiles p
SET password = t.password
FROM public.teachers t
WHERE p.id = t.id
  AND t.password IS NOT NULL
  AND (p.password IS NULL OR p.password = '');

-- 3. Authenticate: trim passwords, cast role to text, check profiles + role tables
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

  IF lower(coalesce(v_profile.role::text, '')) = 'admin' THEN
    RETURN NULL;
  END IF;

  -- Student login
  IF lower(coalesce(v_profile.role::text, '')) = 'student'
     OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_profile.id) THEN
    SELECT * INTO v_student FROM public.students WHERE id = v_profile.id;
    IF FOUND AND (
      trim(coalesce(v_student.password, '')) = v_input
      OR trim(coalesce(v_profile.password, '')) = v_input
    ) THEN
      RETURN jsonb_build_object(
        'id', v_profile.id,
        'name', v_profile.name,
        'email', v_profile.email,
        'phone', v_profile.phone,
        'role', 'student',
        'student_id', v_student.student_id,
        'batch_id', v_student.batch_id,
        'parent_name', v_student.parent_name,
        'parent_phone', v_student.parent_phone,
        'category', v_student.category,
        'stream', v_student.stream,
        'subjects', v_student.subjects,
        'admission_date', v_student.admission_date,
        'total_fees', v_student.total_fees,
        'paid_fees', v_student.paid_fees,
        'attendance_percent', v_student.attendance_percent,
        'performance_score', v_student.performance_score,
        'notes', v_student.notes
      );
    END IF;
  END IF;

  -- Teacher login
  IF lower(coalesce(v_profile.role::text, '')) = 'teacher'
     OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = v_profile.id) THEN
    SELECT * INTO v_teacher FROM public.teachers WHERE id = v_profile.id;
    IF FOUND AND (
      trim(coalesce(v_teacher.password, '')) = v_input
      OR trim(coalesce(v_profile.password, '')) = v_input
    ) THEN
      RETURN jsonb_build_object(
        'id', v_profile.id,
        'name', v_profile.name,
        'email', v_profile.email,
        'phone', v_profile.phone,
        'role', 'teacher',
        'teacher_id', v_teacher.teacher_id,
        'subject', v_teacher.subject,
        'assigned_categories', v_teacher.assigned_categories,
        'permissions', v_teacher.permissions
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_academy_user_by_id(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_teacher public.teachers%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF lower(trim(p_role)) = 'student' THEN
    SELECT * INTO v_student FROM public.students WHERE id = p_user_id;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    RETURN jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.name,
      'email', v_profile.email,
      'phone', v_profile.phone,
      'role', 'student',
      'student_id', v_student.student_id,
      'batch_id', v_student.batch_id,
      'parent_name', v_student.parent_name,
      'parent_phone', v_student.parent_phone,
      'category', v_student.category,
      'stream', v_student.stream,
      'subjects', v_student.subjects,
      'admission_date', v_student.admission_date,
      'total_fees', v_student.total_fees,
      'paid_fees', v_student.paid_fees,
      'attendance_percent', v_student.attendance_percent,
      'performance_score', v_student.performance_score,
      'notes', v_student.notes
    );
  END IF;

  IF lower(trim(p_role)) = 'teacher' THEN
    SELECT * INTO v_teacher FROM public.teachers WHERE id = p_user_id;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    RETURN jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.name,
      'email', v_profile.email,
      'phone', v_profile.phone,
      'role', 'teacher',
      'teacher_id', v_teacher.teacher_id,
      'subject', v_teacher.subject,
      'assigned_categories', v_teacher.assigned_categories,
      'permissions', v_teacher.permissions
    );
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.authenticate_academy_user(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_user_by_id(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.authenticate_academy_user(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_user_by_id(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
