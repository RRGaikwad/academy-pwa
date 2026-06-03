-- =============================================================================
-- RUN THIS ENTIRE FILE IN SUPABASE → SQL Editor → Run
-- Fixes "Account not found" for admin login
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;

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

CREATE OR REPLACE FUNCTION public.lookup_profile_by_id(p_user_id uuid)
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
  WHERE id = p_user_id
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

REVOKE ALL ON FUNCTION public.lookup_profile_for_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_profile_by_id(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lookup_profile_for_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_id(uuid) TO anon, authenticated;

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

GRANT EXECUTE ON FUNCTION public.authenticate_academy_user(text, text) TO anon, authenticated;
