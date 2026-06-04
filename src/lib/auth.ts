import { supabase, isSupabaseConfigured } from './supabase';
import type { UserRole } from '../types';

export type AcademySessionUser = Record<string, unknown> & {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
};

export type LoginResult =
  | { ok: true; user: AcademySessionUser }
  | { ok: false; reason: string };

export const normalizeEmail = (email: string): string => email.toLowerCase().trim();

export const normalizePassword = (password: string): string => password.trim();

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  password?: string | null;
};

type StudentRow = Record<string, unknown> & {
  id: string;
  student_id?: string;
  batch_id?: string;
  parent_name?: string;
  parent_phone?: string;
  category?: string;
  stream?: string;
  subjects?: string[];
  admission_date?: string;
  total_fees?: number;
  paid_fees?: number;
  attendance_percent?: number;
  performance_score?: number;
  notes?: string;
  password?: string;
};

type TeacherRow = Record<string, unknown> & {
  id: string;
  teacher_id?: string;
  subject?: string;
  assigned_categories?: string[];
  permissions?: string[];
  password?: string;
};

const mapRpcProfileRow = (payload: Record<string, unknown>): ProfileRow | null => {
  if (!payload.id) return null;
  return {
    id: String(payload.id),
    name: String(payload.name ?? ''),
    email: String(payload.email ?? ''),
    phone: (payload.phone as string | null) ?? null,
    role: String(payload.role ?? ''),
    password: (payload.password as string | null) ?? null,
  };
};

const isMissingRpcFunction = (message: string): boolean =>
  message.includes('Could not find the function') || message.includes('does not exist');

// Replaced unused constant - all select queries inline their field lists to maintain RLS compatibility
// const profileSelectFields = 'id, name, email, phone, role, password';

async function lookupProfileViaAdminAuthRpc(
  cleanEmail: string,
  password: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase.rpc('authenticate_academy_user', {
    p_email: cleanEmail,
    p_password: normalizePassword(password),
  });

  if (error) {
    if (!isMissingRpcFunction(error.message)) {
      console.warn('RPC authenticate_academy_user (admin):', error.message);
    }
    return null;
  }

  const payload = parseRpcPayload(data);
  if (!payload?.id || String(payload.role ?? '').toLowerCase() !== 'admin') {
    return null;
  }

  const profile = mapRpcProfileRow(payload);
  if (!profile) return null;

  const full = await lookupProfileForLogin(cleanEmail);
  return full ?? profile;
}

export const lookupProfileForLogin = async (email: string): Promise<ProfileRow | null> => {
  const cleanEmail = normalizeEmail(email);

  const { data: rpcData, error: rpcError } = await supabase.rpc('lookup_profile_for_login', {
    p_email: cleanEmail,
  });

  if (!rpcError) {
    const payload = parseRpcPayload(rpcData);
    if (payload) {
      const profile = mapRpcProfileRow(payload);
      if (profile) return profile;
    }
  } else if (!isMissingRpcFunction(rpcError.message)) {
    console.warn('RPC lookup_profile_for_login:', rpcError.message);
  }

  return findProfileByEmailDirect(cleanEmail);
};

/** Resolves a profiles row before login using RPC or simple lookup. Lean and fast. */
export const resolveProfileForLogin = async (
  email: string,
  password?: string
): Promise<ProfileRow | null> => {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;

  // 1. Primary path: RPC lookup (Fastest, bypasses RLS)
  const profile = await lookupProfileForLogin(cleanEmail);
  if (profile) return profile;

  // 2. Fallback for admin-only password RPC (if applicable)
  if (password) {
    const adminProfile = await lookupProfileViaAdminAuthRpc(cleanEmail, password);
    if (adminProfile) return adminProfile;
  }

  // 3. Last resort: Direct table lookup (May fail due to RLS if not authenticated)
  return findProfileByEmailDirect(cleanEmail);
};

export const lookupProfileById = async (userId: string): Promise<ProfileRow | null> => {
  const { data: rpcData, error: rpcError } = await supabase.rpc('lookup_profile_by_id', {
    p_user_id: userId,
  });

  if (!rpcError) {
    const payload = parseRpcPayload(rpcData);
    if (payload) {
      const profile = mapRpcProfileRow(payload);
      if (profile) return profile;
    }
  } else if (!isMissingRpcFunction(rpcError.message)) {
    console.warn('RPC lookup_profile_by_id:', rpcError.message);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, password')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Profile lookup by id failed:', error.message);
    return null;
  }
  return data as ProfileRow | null;
};

const parseRpcPayload = (data: unknown): Record<string, unknown> | null => {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
};

const mapStudentSession = (profile: ProfileRow, student: StudentRow): AcademySessionUser => ({
  id: profile.id,
  name: profile.name,
  email: profile.email,
  phone: profile.phone ?? '',
  role: 'student',
  studentId: student.student_id,
  batchId: student.batch_id,
  parentName: student.parent_name,
  parentPhone: student.parent_phone,
  category: student.category,
  stream: student.stream,
  subjects: student.subjects ?? [],
  admissionDate: student.admission_date,
  totalFees: Number(student.total_fees) || 0,
  paidFees: Number(student.paid_fees) || 0,
  attendancePercent: Number(student.attendance_percent) || 0,
  performanceScore: Number(student.performance_score) || 0,
  notes: student.notes ?? '',
});

const mapTeacherSession = (profile: ProfileRow, teacher: TeacherRow): AcademySessionUser => ({
  id: profile.id,
  name: profile.name,
  email: profile.email,
  phone: profile.phone ?? '',
  role: 'teacher',
  teacherId: teacher.teacher_id,
  subject: teacher.subject,
  assignedCategories: teacher.assigned_categories ?? [],
  permissions: teacher.permissions ?? [],
});

const mapRpcSession = (data: Record<string, unknown>): AcademySessionUser | null => {
  const role = String(data.role ?? '').toLowerCase();
  if (!data.id || (role !== 'student' && role !== 'teacher')) {
    return null;
  }
  if (role === 'student') {
    return {
      id: String(data.id),
      name: String(data.name ?? ''),
      email: String(data.email ?? ''),
      phone: String(data.phone ?? ''),
      role: 'student',
      studentId: data.student_id,
      batchId: data.batch_id,
      parentName: data.parent_name,
      parentPhone: data.parent_phone,
      category: data.category,
      stream: data.stream,
      subjects: (data.subjects as string[]) ?? [],
      admissionDate: data.admission_date,
      totalFees: Number(data.total_fees) || 0,
      paidFees: Number(data.paid_fees) || 0,
      attendancePercent: Number(data.attendance_percent) || 0,
      performanceScore: Number(data.performance_score) || 0,
      notes: data.notes ?? '',
    };
  }
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    role: 'teacher',
    teacherId: data.teacher_id,
    subject: data.subject,
    assignedCategories: (data.assigned_categories as string[]) ?? [],
    permissions: (data.permissions as string[]) ?? [],
  };
};

const passwordsMatch = (
  stored: string | null | undefined,
  input: string,
  profilePassword?: string | null
): boolean => {
  const normalized = normalizePassword(input);
  if (!normalized) return false;
  const candidates = [stored, profilePassword].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );
  return candidates.some((v) => v.trim() === normalized);
};

async function findProfileByEmailDirect(email: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, password')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.warn('Profile lookup failed:', error.message);
    return null;
  }
  return data as ProfileRow | null;
}

async function findProfileByEmail(email: string): Promise<ProfileRow | null> {
  return lookupProfileForLogin(email);
}

async function resolveRole(profile: ProfileRow): Promise<'student' | 'teacher' | 'admin' | null> {
  const fromProfile = profile.role?.toLowerCase();
  if (fromProfile === 'student' || fromProfile === 'teacher' || fromProfile === 'admin') {
    return fromProfile;
  }

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('id', profile.id)
    .maybeSingle();
  if (student) return 'student';

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('id', profile.id)
    .maybeSingle();
  if (teacher) return 'teacher';

  return null;
}

async function authenticateAcademyUserDirect(
  cleanEmail: string,
  password: string
): Promise<AcademySessionUser | null> {
  const profile = await findProfileByEmail(cleanEmail);
  if (!profile) return null;

  const role = await resolveRole(profile);
  if (!role || role === 'admin') return null;

  if (role === 'student') {
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle();

    if (error || !student) return null;
    if (!passwordsMatch(student.password as string, password, profile.password)) {
      return null;
    }
    return mapStudentSession(profile, student as StudentRow);
  }

  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', profile.id)
    .maybeSingle();

  if (error || !teacher) return null;
  if (!passwordsMatch(teacher.password as string, password, profile.password)) {
    return null;
  }
  return mapTeacherSession(profile, teacher as TeacherRow);
}

export async function authenticateAcademyUser(
  email: string,
  password: string
): Promise<AcademySessionUser | null> {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = normalizePassword(password);

  const { data: rpcData, error: rpcError } = await supabase.rpc('authenticate_academy_user', {
    p_email: cleanEmail,
    p_password: cleanPassword,
  });

  if (rpcError) {
    const missingFn =
      rpcError.message.includes('Could not find the function') ||
      rpcError.message.includes('does not exist');
    if (!missingFn) {
      console.warn('RPC authenticate_academy_user:', rpcError.message);
    }
  } else {
    const payload = parseRpcPayload(rpcData);
    if (payload) {
      const user = mapRpcSession(payload);
      if (user) return user;
    }
  }

  return authenticateAcademyUserDirect(cleanEmail, cleanPassword);
}

export async function restoreAcademyUserById(
  userId: string,
  role: 'student' | 'teacher'
): Promise<AcademySessionUser | null> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_academy_user_by_id', {
    p_user_id: userId,
    p_role: role,
  });

  if (!rpcError) {
    const payload = parseRpcPayload(rpcData);
    if (payload) {
      const user = mapRpcSession(payload);
      if (user) return user;
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, password')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return null;

  if (role === 'student') {
    const { data: student } = await supabase.from('students').select('*').eq('id', userId).maybeSingle();
    if (!student) return null;
    return mapStudentSession(profile as ProfileRow, student as StudentRow);
  }

  const { data: teacher } = await supabase.from('teachers').select('*').eq('id', userId).maybeSingle();
  if (!teacher) return null;
  return mapTeacherSession(profile as ProfileRow, teacher as TeacherRow);
}

export async function authenticateAdminUser(
  profile: ProfileRow,
  email: string,
  password: string
): Promise<LoginResult> {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = normalizePassword(password);

  // 1. Attempt Supabase Auth login (Required for RLS to work properly)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });

  // 2. Check if password matches profiles table (fallback/verification)
  const isPasswordCorrect = passwordsMatch(profile.password, password);

  if (authError) {
    // If Supabase Auth fails AND profiles password doesn't match, it's a wrong password
    if (!isPasswordCorrect) {
      return { ok: false, reason: 'Incorrect admin password. Please check your credentials.' };
    }
    
    // If Auth fails but profiles password matches, the user exists in profiles but 
    // maybe not in auth.users or has a different password there.
    console.warn('Admin Supabase Auth failed, but profiles password matches:', authError.message);
  }

  return {
    ok: true,
    user: {
      id: authData.user?.id || profile.id,
      name: profile.name || 'Admin',
      email: profile.email || cleanEmail,
      phone: profile.phone ?? '',
      role: 'admin',
    },
  };
}

export async function performAcademyLogin(email: string, password: string): Promise<LoginResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      reason:
        'App is not connected to Supabase. Add your Project URL and anon key to a `.env` file, then restart the dev server.',
    };
  }

  const cleanEmail = normalizeEmail(email);
  const cleanPassword = normalizePassword(password);
  if (!cleanEmail || !cleanPassword) {
    return { ok: false, reason: 'Email and password are required.' };
  }

  const user = await authenticateAcademyUser(cleanEmail, cleanPassword);
  if (!user) {
    return {
      ok: false,
      reason:
        'Incorrect email or password. In Admin, open the student/teacher, confirm the password field, click Update, then try again.',
    };
  }

  return { ok: true, user };
}
