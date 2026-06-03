-- Bypass RLS for pre-login profile lookup (admin, student, teacher routing).
-- Run in Supabase SQL Editor if migrations are not auto-applied.

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
