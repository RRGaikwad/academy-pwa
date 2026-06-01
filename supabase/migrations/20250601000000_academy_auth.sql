-- Run this in Supabase SQL Editor (Dashboard → SQL) so student/teacher login works with RLS enabled.
-- These functions run with elevated privileges and only return data after password verification.

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
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF lower(coalesce(v_profile.role, '')) = 'admin' THEN
    RETURN NULL;
  END IF;

  IF lower(coalesce(v_profile.role, '')) = 'student'
     OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_profile.id) THEN
    SELECT * INTO v_student FROM public.students WHERE id = v_profile.id;
    IF FOUND AND v_student.password IS NOT NULL AND v_student.password = p_password THEN
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

  IF lower(coalesce(v_profile.role, '')) = 'teacher'
     OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = v_profile.id) THEN
    SELECT * INTO v_teacher FROM public.teachers WHERE id = v_profile.id;
    IF FOUND AND v_teacher.password IS NOT NULL AND v_teacher.password = p_password THEN
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

  IF lower(p_role) = 'student' THEN
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

  IF lower(p_role) = 'teacher' THEN
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
