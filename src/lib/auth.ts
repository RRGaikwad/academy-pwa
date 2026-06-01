import { supabase } from './supabase';
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

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
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

const mapRpcSession = (data: Record<string, unknown>): AcademySessionUser => {
  const role = String(data.role ?? '').toLowerCase() as UserRole;
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

const passwordsMatch = (stored: string | null | undefined, input: string): boolean =>
  typeof stored === 'string' && stored.length > 0 && stored === input;

async function findProfileByEmail(email: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.warn('Profile lookup failed:', error.message);
    return null;
  }
  return data as ProfileRow | null;
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

    if (error || !student || !passwordsMatch(student.password as string, password)) {
      return null;
    }
    return mapStudentSession(profile, student as StudentRow);
  }

  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', profile.id)
    .maybeSingle();

  if (error || !teacher || !passwordsMatch(teacher.password as string, password)) {
    return null;
  }
  return mapTeacherSession(profile, teacher as TeacherRow);
}

export async function authenticateAcademyUser(
  email: string,
  password: string
): Promise<AcademySessionUser | null> {
  const cleanEmail = normalizeEmail(email);

  const { data: rpcData, error: rpcError } = await supabase.rpc('authenticate_academy_user', {
    p_email: cleanEmail,
    p_password: password,
  });

  if (!rpcError && rpcData && typeof rpcData === 'object') {
    return mapRpcSession(rpcData as Record<string, unknown>);
  }

  if (rpcError && !rpcError.message.includes('Could not find the function')) {
    console.warn('RPC authenticate_academy_user:', rpcError.message);
  }

  return authenticateAcademyUserDirect(cleanEmail, password);
}

export async function restoreAcademyUserById(
  userId: string,
  role: 'student' | 'teacher'
): Promise<AcademySessionUser | null> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_academy_user_by_id', {
    p_user_id: userId,
    p_role: role,
  });

  if (!rpcError && rpcData && typeof rpcData === 'object') {
    return mapRpcSession(rpcData as Record<string, unknown>);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role')
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

export async function performAcademyLogin(email: string, password: string): Promise<LoginResult> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !password) {
    return { ok: false, reason: 'Email and password are required.' };
  }

  const user = await authenticateAcademyUser(cleanEmail, password);
  if (!user) {
    return {
      ok: false,
      reason:
        'Incorrect email or password. Use the exact credentials shown when your account was created.',
    };
  }

  return { ok: true, user };
}
