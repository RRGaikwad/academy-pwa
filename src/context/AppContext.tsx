import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  User, Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial,
  Category, Stream, SubjectName, MCQQuestion 
} from '../types';
import { supabase } from '../lib/supabase';
import {
  type AcademySessionUser,
  type LoginResult,
  authenticateAdminUser,
  lookupProfileById,
  lookupProfileForLogin,
  normalizeEmail,
  resolveProfileForLogin,
  performAcademyLogin,
  restoreAcademyUserById,
} from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { usePWA } from '../hooks/usePWA';

const STORAGE_KEYS = {
  USER: 'ams_user',
  ACTIVE_TAB: 'ams_active_tab',
  EXAMS: 'ams_exams',
  ANNOUNCEMENTS: 'ams_announcements',
  STUDENTS: 'ams_students',
  TEACHERS: 'ams_teachers',
  BATCHES: 'ams_batches',
  ATTENDANCE: 'ams_attendance'
};

interface AppContextType {
  currentUser: (User & any) | null;
  setCurrentUser: (user: (User & any) | null) => void;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  batches: Batch[];
  setBatches: React.Dispatch<React.SetStateAction<Batch[]>>;
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  examResults: ExamResult[];
  setExamResults: React.Dispatch<React.SetStateAction<ExamResult[]>>;
  feePayments: FeePayment[];
  setFeePayments: React.Dispatch<React.SetStateAction<FeePayment[]>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  studyMaterials: StudyMaterial[];
  setStudyMaterials: React.Dispatch<React.SetStateAction<StudyMaterial[]>>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  loading: boolean;
  authLoading: boolean;
  isInstallable: boolean;
  installApp: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const SYNC_TIMEOUT_MS = 12_000;

const toAdminSession = (user: AcademySessionUser | Record<string, unknown>): AcademySessionUser => ({
  id: String(user.id),
  name: String(user.name || 'Admin'),
  email: String(user.email || ''),
  phone: String(user.phone ?? ''),
  role: 'admin',
});

const withSyncTimeout = <T,>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Data sync timed out')), SYNC_TIMEOUT_MS);
    }),
  ]);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInstallable, installApp } = usePWA();
  const [currentUser, setCurrentUser] = useState<(User & any) | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const syncGenerationRef = useRef(0);
  const isAuthenticatingRef = useRef(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'dashboard';
  });

  const applyFetchedData = useCallback((
    profiles: Record<string, unknown>[],
    studentsRes: { data: Record<string, unknown>[] | null; error?: any },
    teachersRes: { data: Record<string, unknown>[] | null; error?: any },
    batchesRes: { data: Record<string, unknown>[] | null; error?: any },
    announcementsRes: { data: Record<string, unknown>[] | null; error?: any },
    examsRes: { data: Record<string, unknown>[] | null; error?: any },
    attendanceRes: { data: Record<string, unknown>[] | null; error?: any },
    feePaymentsRes: { data: Record<string, unknown>[] | null; error?: any },
    studyMaterialsRes: { data: Record<string, unknown>[] | null; error?: any },
    examResultsRes: { data: Record<string, unknown>[] | null; error?: any }
  ) => {
    if (studentsRes.data) {
      console.log(`[AppContext] Loaded ${studentsRes.data.length} students`);
      const formatted: Student[] = studentsRes.data.map((s) => {
        const p = profiles.find((prof) => prof.id === s.id) || {};
        return {
          ...s,
          id: String(s.id),
          name: (p.name as string) || 'Unknown',
          email: (p.email as string) || '',
          phone: (p.phone as string) || '',
          role: 'student' as const,
          studentId: String(s.student_id || ''),
          batchId: String(s.batch_id || ''),
          category: (s.category as Category) || '11th',
          stream: (s.stream as Stream) || 'PCM',
          parentName: (s.parent_name as string) || '',
          parentPhone: (s.parent_phone as string) || '',
          attendancePercent: Number(s.attendance_percent) || 0,
          performanceScore: Number(s.performance_score) || 0,
          subjects: (s.subjects as SubjectName[]) || [],
          admissionDate: (s.admission_date as string) || '',
          totalFees: Number(s.total_fees) || 0,
          paidFees: Number(s.paid_fees) || 0,
          notes: (s.notes as string) || '',
          password: (s.password as string) || '',
        } as Student;
      });
      setStudents(formatted);
    } else if (studentsRes.error) {
      console.error('[AppContext] Error loading students:', studentsRes.error);
    }

    if (teachersRes.data) {
      console.log(`[AppContext] Loaded ${teachersRes.data.length} teachers`);
      const formatted: Teacher[] = teachersRes.data.map((t) => {
        const p = profiles.find((prof) => prof.id === t.id) || {};
        return {
          ...t,
          id: String(t.id),
          name: (p.name as string) || 'Unknown',
          email: (p.email as string) || '',
          phone: (p.phone as string) || '',
          role: 'teacher' as const,
          teacherId: String(t.teacher_id || ''),
          subject: (t.subject as SubjectName) || 'Physics',
          assignedCategories: (t.assigned_categories as string[]) || [],
          permissions: (t.permissions as string[]) || [],
          password: (t.password as string) || '',
        } as Teacher;
      });
      setTeachers(formatted);
    } else if (teachersRes.error) {
      console.error('[AppContext] Error loading teachers:', teachersRes.error);
    }

    if (batchesRes.data) {
      console.log(`[AppContext] Loaded ${batchesRes.data.length} batches`);
      setBatches(
        batchesRes.data.map((b) => ({
          ...b,
          id: String(b.id),
          studentIds: (b.student_ids as string[]) || [],
          teacherIds: (b.teacher_ids as string[]) || [],
        })) as Batch[]
      );
    } else if (batchesRes.error) {
      console.error('[AppContext] Error loading batches:', batchesRes.error);
    }

    if (announcementsRes.data) {
      console.log(`[AppContext] Loaded ${announcementsRes.data.length} announcements`);
      setAnnouncements(
        announcementsRes.data.map((a) => ({
          ...a,
          id: String(a.id),
          authorId: a.author_id,
          authorName: a.author_name,
          targetRole: a.target_role,
          targetBatch: a.target_batch,
          createdAt: a.created_at,
          referenceId: a.reference_id,
        })) as Announcement[]
      );
    } else if (announcementsRes.error) {
      console.error('[AppContext] Error loading announcements:', announcementsRes.error);
    }

    if (examsRes.data) {
      console.log(`[AppContext] Loaded ${examsRes.data.length} exams`);
      setExams(
        examsRes.data.map((e) => ({
          ...e,
          id: String(e.id),
          duration: Number(e.duration) || 0,
          teacherId: e.teacher_id,
          batchId: e.batch_id,
          scheduledAt: e.scheduled_at,
          questions: (e.questions as MCQQuestion[]) || [],
          chapterTags: (e.chapter_tags as string[]) || [],
          hasNegativeMarking: e.has_negative_marking,
        })) as Exam[]
      );
    } else if (examsRes.error) {
      console.error('[AppContext] Error loading exams:', examsRes.error);
    }

    if (attendanceRes.data) {
      console.log(`[AppContext] Loaded ${attendanceRes.data.length} attendance records`);
      setAttendance(
        attendanceRes.data.map((at) => ({
          ...at,
          id: String(at.id),
          batchId: at.batch_id,
          teacherId: at.teacher_id,
          records: (at.records as { studentId: string; present: boolean }[]) || [],
        })) as AttendanceRecord[]
      );
    } else if (attendanceRes.error) {
      console.error('[AppContext] Error loading attendance:', attendanceRes.error);
    }

    if (feePaymentsRes.data) {
      console.log(`[AppContext] Loaded ${feePaymentsRes.data.length} fee payments`);
      setFeePayments(
        feePaymentsRes.data.map((p) => ({
          ...p,
          id: String(p.id),
          amount: Number(p.amount) || 0,
          studentId: p.student_id,
          receiptNo: p.receipt_no,
        })) as FeePayment[]
      );
    } else if (feePaymentsRes.error) {
      console.error('[AppContext] Error loading fee payments:', feePaymentsRes.error);
    }

    if (studyMaterialsRes.data) {
      console.log(`[AppContext] Loaded ${studyMaterialsRes.data.length} study materials`);
      setStudyMaterials(
        studyMaterialsRes.data.map((m) => ({
          ...m,
          id: String(m.id),
          batchId: m.batch_id,
          teacherId: m.teacher_id,
          fileUrl: m.file_url,
          fileName: m.file_name,
          uploadedAt: m.uploaded_at,
        })) as StudyMaterial[]
      );
    } else if (studyMaterialsRes.error) {
      console.error('[AppContext] Error loading study materials:', studyMaterialsRes.error);
    }

    if (examResultsRes.data) {
      console.log(`[AppContext] Loaded ${examResultsRes.data.length} exam results`);
      setExamResults(
        examResultsRes.data.map((r) => ({
          ...r,
          id: String(r.id),
          examId: r.exam_id,
          studentId: r.student_id,
          answers: (r.answers as number[]) || [],
          score: Number(r.score) || 0,
          totalMarks: Number(r.total_marks) || 0,
          accuracy: Number(r.accuracy) || 0,
          rank: r.rank ? Number(r.rank) : undefined,
          submittedAt: r.submitted_at,
          weakChapters: (r.weak_chapters as string[]) || [],
        })) as ExamResult[]
      );
    } else if (examResultsRes.error) {
      console.error('[AppContext] Error loading exam results:', examResultsRes.error);
    }
  }, []);

  const refreshData = useCallback(async (options?: { showIndicator?: boolean }) => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    const generation = ++syncGenerationRef.current;
    if (options?.showIndicator) {
      setLoading(true);
    }

    try {
      const fetchTable = async (table: string, query: any) => {
        try {
          const res = (await withSyncTimeout(query)) as { data: any; error: any };
          if (res.error) {
            // Ignore "relation does not exist" errors (42P01) - means table isn't created yet
            if (res.error.code === '42P01') {
              return { data: [], error: null };
            }
            console.warn(`Error fetching ${table}:`, res.error.message);
            return { data: null, error: res.error };
          }
          return { data: res.data, error: null };
        } catch (e: any) {
          console.warn(`Timeout or exception fetching ${table}:`, e.message);
          return { data: null, error: e };
        }
      };

      const [
        profilesRes,
        studentsRes,
        teachersRes,
        batchesRes,
        announcementsRes,
        examsRes,
        attendanceRes,
        feePaymentsRes,
        studyMaterialsRes,
        examResultsRes,
      ] = await Promise.all([
        fetchTable('profiles', supabase.from('profiles').select('*')),
        fetchTable('students', supabase.from('students').select('*')),
        fetchTable('teachers', supabase.from('teachers').select('*')),
        fetchTable('batches', supabase.from('batches').select('*')),
        fetchTable('announcements', supabase.from('announcements').select('*').order('created_at', { ascending: false })),
        fetchTable('exams', supabase.from('exams').select('*').order('scheduled_at', { ascending: false })),
        fetchTable('attendance', supabase.from('attendance').select('*')),
        fetchTable('fee_payments', supabase.from('fee_payments').select('*').order('date', { ascending: false })),
        fetchTable('study_materials', supabase.from('study_materials').select('*').order('uploaded_at', { ascending: false })),
        fetchTable('exam_results', supabase.from('exam_results').select('*').order('submitted_at', { ascending: false })),
      ]);

      if (generation !== syncGenerationRef.current) return;

      applyFetchedData(
        profilesRes.data || [],
        studentsRes,
        teachersRes,
        batchesRes,
        announcementsRes,
        examsRes,
        attendanceRes,
        feePaymentsRes,
        studyMaterialsRes,
        examResultsRes
      );
    } catch (err) {
      console.error('Unified data sync error:', err);
    } finally {
      if (generation === syncGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [currentUser?.id, applyFetchedData]);

  // Unified Auth State Listener
  useEffect(() => {
    let isMounted = true;

    const syncProfile = async (userId: string, sessionEmail?: string) => {
      try {
        // 1. Try to get profile (RPC bypasses RLS)
        const profileById = await lookupProfileById(userId);
        let profile: Record<string, unknown> = profileById
          ? { ...profileById }
          : { id: userId };

        // 1b. Supabase Auth UUID may differ from profiles.id — resolve by email
        if (!profile.role && sessionEmail) {
          const byEmail = await lookupProfileForLogin(sessionEmail);
          if (byEmail) {
            profile = { ...byEmail };
          }
        }

        // 2. If no role in profile, check students table
        if (!profile.role) {
          const { data: student } = await supabase
            .from('students')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          
          if (student) {
            profile = { ...profile, ...student, role: 'student' };
          }
        }

        // 3. Still no role? check teachers table
        if (!profile.role) {
          const { data: teacher } = await supabase
            .from('teachers')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          
          if (teacher) {
            profile = { ...profile, ...teacher, role: 'teacher' };
          }
        }
        
        const role = String(profile.role ?? '').toLowerCase();
        profile.role = role;

        // Only update current user if we're not in the middle of a manual login
        if (isMounted && role) {
          const sessionUser =
            role === 'admin'
              ? toAdminSession(profile)
              : { ...profile, role };
          setCurrentUser(sessionUser);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionUser));
        } else if (isMounted && !isAuthenticatingRef.current) {
          const cached = parseCachedUser();
          const cachedRole = cached?.role?.toString().toLowerCase();
          if (cachedRole === 'admin' && cached?.id) {
            const adminUser = toAdminSession(cached);
            setCurrentUser(adminUser);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminUser));
          } else {
            console.warn('User authenticated but no role found in profiles, students, or teachers');
            setCurrentUser(null);
            localStorage.removeItem(STORAGE_KEYS.USER);
          }
        }
      } catch (err) {
        console.error('Profile sync error:', err);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    const parseCachedUser = (): AcademySessionUser | null => {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (!saved) return null;
      try {
        return JSON.parse(saved) as AcademySessionUser;
      } catch {
        return null;
      }
    };

    const initAuth = async () => {
      try {
        const cachedUser = parseCachedUser();
        const cachedRole = cachedUser?.role?.toString().toLowerCase();

        // Fast path: restore admin from cache so refresh never stalls on auth
        if (cachedRole === 'admin' && cachedUser?.id && isMounted) {
          const adminUser = toAdminSession(cachedUser);
          setCurrentUser(adminUser);
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          await syncProfile(session.user.id, session.user.email);
          if (isMounted) setAuthLoading(false);
          return;
        }

        if (cachedUser?.id) {
          if (cachedRole === 'student' || cachedRole === 'teacher') {
            const restored = await restoreAcademyUserById(
              cachedUser.id,
              cachedRole as 'student' | 'teacher'
            );
            if (isMounted) {
              if (restored) {
                setCurrentUser(restored);
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(restored));
              } else {
                setCurrentUser(cachedUser);
              }
              setAuthLoading(false);
            }
            return;
          }

          if (cachedRole === 'admin' && isMounted) {
            const verifyAdmin = await lookupProfileById(cachedUser.id);
            if (verifyAdmin?.role?.toLowerCase() === 'admin') {
              const adminUser = toAdminSession(verifyAdmin);
              setCurrentUser(adminUser);
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminUser));
            }
            setAuthLoading(false);
            return;
          }
        }

        if (isMounted && cachedRole !== 'admin') {
          setCurrentUser(null);
          localStorage.removeItem(STORAGE_KEYS.USER);
        }
      } catch (err) {
        console.error('Auth init error:', err);
        const cached = parseCachedUser();
        if (isMounted && cached?.role?.toString().toLowerCase() !== 'admin') {
          setCurrentUser(null);
          localStorage.removeItem(STORAGE_KEYS.USER);
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        await syncProfile(session.user.id, session.user.email);
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setCurrentUser(null);
          localStorage.removeItem(STORAGE_KEYS.USER);
          setAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  // Supabase Data Fetching & Real-time Subscriptions (background — never blocks the UI)
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    void refreshData();

    const tables = [
      { name: 'profiles', fetcher: () => void refreshData() },
      { name: 'students', fetcher: () => void refreshData() },
      { name: 'teachers', fetcher: () => void refreshData() },
      { name: 'batches', fetcher: () => void refreshData() },
      { name: 'announcements', fetcher: () => void refreshData() },
      { name: 'exams', fetcher: () => void refreshData() },
      { name: 'attendance', fetcher: () => void refreshData() },
      { name: 'fee_payments', fetcher: () => void refreshData() },
      { name: 'study_materials', fetcher: () => void refreshData() },
      { name: 'exam_results', fetcher: () => void refreshData() },
    ];

    const channels = tables.map((table) =>
      supabase
        .channel(`public:${table.name}:${userId}`)
        .on('postgres_changes', { event: '*', table: table.name, schema: 'public' }, () => {
          void table.fetcher();
        })
        .subscribe()
    );

    return () => {
      setLoading(false);
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [currentUser?.id, refreshData]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      isAuthenticatingRef.current = true;
      localStorage.removeItem(STORAGE_KEYS.USER);
      if (!isSupabaseConfigured()) {
        return { ok: false, reason: 'Supabase not configured.' };
      }

      const cleanEmail = normalizeEmail(email);
      const cleanPassword = password.trim();

      // 1. Resolve profile (RPC, profiles.password RPC, or Supabase Auth + RLS)
      const profile = await resolveProfileForLogin(cleanEmail, password);

      if (!profile) {
        return {
          ok: false,
          reason:
            'Admin account not found. To fix this: 1. Go to Supabase SQL Editor. 2. Run the "FIX_ADMIN_PERMISSIONS.sql" script. 3. Ensure your email is in the "profiles" table with role="admin".',
        };
      }

      const role = profile.role?.toLowerCase();

      // 2. Handle ADMIN Login (any profiles row with role = admin)
      if (role === 'admin') {
        const adminResult = await authenticateAdminUser(profile, cleanEmail, password);
        if (!adminResult.ok) {
          return adminResult;
        }

        setCurrentUser(adminResult.user);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminResult.user));
        setActiveTab('dashboard');
        return adminResult;
      }

      // 3. Handle STUDENT/TEACHER Login (Uses performAcademyLogin which checks respective tables)
      const academyResult = await performAcademyLogin(cleanEmail, cleanPassword);
      if (!academyResult.ok) {
        return academyResult;
      }

      setCurrentUser(academyResult.user);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(academyResult.user));
      setActiveTab('dashboard');
      return academyResult;
    } catch (err) {
      console.error('Unified Login Error:', err);
      return { ok: false, reason: 'An unexpected error occurred. Please try again.' };
    } finally {
      isAuthenticatingRef.current = false;
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
    supabase.auth.signOut(); // Sign out from Supabase
    // Add clear storage option for developers or full reset
    const clearAllData = () => {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      window.location.reload();
    };
    (window as any).clearAcademyData = clearAllData;
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser,
      students, setStudents,
      teachers, setTeachers,
      batches, setBatches,
      attendance, setAttendance,
      exams, setExams,
      examResults, setExamResults,
      feePayments, setFeePayments,
      announcements, setAnnouncements,
      studyMaterials, setStudyMaterials,
      login, logout,
      activeTab, setActiveTab,
      loading,
      authLoading,
      isInstallable,
      installApp,
      refresh: () => refreshData({ showIndicator: true })
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
