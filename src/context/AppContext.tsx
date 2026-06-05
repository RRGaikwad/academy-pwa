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
  const [authLoading, setAuthLoading] = useState(() => {
    // If no user in storage, don't show loading screen, go straight to login
    return !!localStorage.getItem(STORAGE_KEYS.USER);
  });
  const [sessionReady, setSessionReady] = useState(false);
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
        // Run lookups in parallel to speed up role resolution
        const [profileById, studentRes, teacherRes] = await Promise.all([
          lookupProfileById(userId),
          supabase.from('students').select('*').eq('id', userId).maybeSingle(),
          supabase.from('teachers').select('*').eq('id', userId).maybeSingle()
        ]);

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

        // 2. If no role in profile, check results from parallel queries
        if (!profile.role && studentRes.data) {
          profile = { ...profile, ...studentRes.data, role: 'student' };
        }

        // 3. Still no role? check teachers table
        if (!profile.role && teacherRes.data) {
          profile = { ...profile, ...teacherRes.data, role: 'teacher' };
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
          setAuthLoading(false); // Immediate unlock for cached admins
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (isMounted) setSessionReady(true);

        if (sessionError) {
          console.warn('Session check error:', sessionError.message);
        }

        if (session?.user) {
          await syncProfile(session.user.id, session.user.email);
          if (isMounted) setAuthLoading(false);
          return;
        }

        // If we reach here, there's no active Supabase session
        if (cachedUser?.id && !isAuthenticatingRef.current) {
          // If we have a cached admin, keep it but try to verify background
          if (cachedRole === 'admin' && isMounted) {
            // Background verification, don't block
            lookupProfileById(cachedUser.id).then(verifyAdmin => {
              if (isMounted && verifyAdmin?.role?.toLowerCase() === 'admin') {
                const adminUser = toAdminSession(verifyAdmin);
                setCurrentUser(adminUser);
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminUser));
              }
            }).catch(() => {});
            
            if (isMounted) setAuthLoading(false);
            return;
          }

          if ((cachedRole === 'student' || cachedRole === 'teacher') && isMounted) {
            // Restore from cache but don't block auth screen
            restoreAcademyUserById(cachedUser.id, cachedRole as 'student' | 'teacher')
              .then(restored => {
                if (isMounted && restored) {
                  setCurrentUser(restored);
                  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(restored));
                }
              }).catch(() => {});
            
            if (isMounted) setAuthLoading(false);
            return;
          }
        }

        // Final fallback: clear loading and user if no session found
        if (isMounted) {
          if (!isAuthenticatingRef.current) {
            setCurrentUser(null);
            localStorage.removeItem(STORAGE_KEYS.USER);
          }
          setAuthLoading(false);
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
    if (!userId || !sessionReady) {
      if (!userId) setLoading(false);
      return;
    }

    void refreshData();

    // Use a single channel for all database changes to reduce overhead and improve sync speed
    const channel = supabase
      .channel('db-all-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('[Realtime] Change detected:', payload.table);
          // Debounce refresh to avoid multiple rapid reloads
          void refreshData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected to database changes');
        }
      });

    return () => {
      setLoading(false);
      void supabase.removeChannel(channel);
    };
  }, [currentUser?.id, refreshData]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      isAuthenticatingRef.current = true;
      const cleanEmail = normalizeEmail(email);
      const cleanPassword = password.trim();

      if (!isSupabaseConfigured()) {
        return { ok: false, reason: 'Supabase not configured.' };
      }

      // 1. Start Auth and Profile resolution in parallel
      const authPromise = supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword })
        .catch(err => ({ data: { user: null, session: null }, error: err }));
      
      // Profile resolution can be slower, so we'll wrap it in a small timeout for the "instant" path
      const profilePromise = resolveProfileForLogin(cleanEmail).catch(() => null);

      // 2. Wait for Supabase Auth response (usually the most definitive and fastest)
      const authResponse = await authPromise;
      const { data: authData, error: authError } = authResponse;

      // 3. Success Path A: Supabase Auth Succeeded
      if (!authError && authData.user) {
        // Force immediate unlock
        setAuthLoading(false);
        isAuthenticatingRef.current = false;

        // Try to get profile from parallel promise or ID lookup
        let resolvedProfile = await Promise.race([
          profilePromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
        ]);

        if (!resolvedProfile) {
          resolvedProfile = await lookupProfileById(authData.user.id);
        }

        if (resolvedProfile) {
          const role = resolvedProfile.role?.toLowerCase() || 'student';
          const sessionUser = role === 'admin' 
            ? toAdminSession(resolvedProfile) 
            : { ...resolvedProfile, role } as any;

          setCurrentUser(sessionUser);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionUser));
          setSessionReady(true); // Ensure session is marked ready for data fetch
          setActiveTab('dashboard');
          return { ok: true, user: sessionUser };
        }
      }

      // 4. Success Path B: Profile found but Auth failed (Fallback to Academy RPC login)
      // This handles cases where user is in profiles table but not yet in auth.users
      const profile = await profilePromise;
      if (profile) {
        const role = profile.role?.toLowerCase();
        
        if (role === 'admin') {
          // If admin auth failed but we have a profile, check local password as last resort
          const adminResult = await authenticateAdminUser(profile, cleanEmail, cleanPassword);
          if (adminResult.ok) {
            setCurrentUser(adminResult.user);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminResult.user));
            setActiveTab('dashboard');
            return adminResult;
          }
          return adminResult;
        }

        // Student/Teacher academy login
        const academyResult = await performAcademyLogin(cleanEmail, cleanPassword);
        if (academyResult.ok) {
          setCurrentUser(academyResult.user);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(academyResult.user));
          setActiveTab('dashboard');
        }
        return academyResult;
      }

      return {
        ok: false,
        reason: authError?.message || 'Invalid email or password. Please try again.',
      };
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
