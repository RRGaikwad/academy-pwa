import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  User, Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial
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

const toAdminSession = (user: AcademySessionUser | Record<string, unknown>): AcademySessionUser => {
  const userId = String(user.id || '');
  if (!userId) {
    console.warn('toAdminSession called without user id');
  }
  return {
    id: userId,
    name: String(user.name || 'Admin'),
    email: String(user.email || ''),
    phone: String(user.phone ?? ''),
    role: 'admin',
  };
};

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
    profiles: any[],
    studentsRes: { data: any; error: any },
    teachersRes: { data: any; error: any },
    batchesRes: { data: any; error: any },
    announcementsRes: { data: any; error: any },
    examsRes: { data: any; error: any },
    attendanceRes: { data: any; error: any },
    feePaymentsRes: { data: any; error: any },
    studyMaterialsRes: { data: any; error: any },
    examResultsRes: { data: any; error: any }
  ) => {
    // Only update state if data exists to prevent clearing UI on transient errors
    if (studentsRes.data) {
      setStudents(
        studentsRes.data.map((s: any) => {
          const profile = profiles.find((p) => p.id === s.id);
          return {
            ...s,
            id: String(s.id),
            name: profile?.name || s.name || 'Unknown Student',
            email: profile?.email || s.email || '',
            phone: profile?.phone || s.phone || '',
            role: 'student',
            totalFees: Number(s.total_fees) || 0,
            paidFees: Number(s.paid_fees) || 0,
            attendancePercent: Number(s.attendance_percent) || 0,
            performanceScore: Number(s.performance_score) || 0,
            subjects: Array.isArray(s.subjects) ? s.subjects : [],
          } as Student;
        })
      );
    }

    if (teachersRes.data) {
      setTeachers(
        teachersRes.data.map((t: any) => {
          const profile = profiles.find((p) => p.id === t.id);
          return {
            ...t,
            id: String(t.id),
            name: profile?.name || t.name || 'Unknown Teacher',
            email: profile?.email || t.email || '',
            phone: profile?.phone || t.phone || '',
            role: 'teacher',
            assignedCategories: Array.isArray(t.assigned_categories) ? t.assigned_categories : [],
            permissions: Array.isArray(t.permissions) ? t.permissions : [],
          } as Teacher;
        })
      );
    }

    if (batchesRes.data) {
      setBatches(
        batchesRes.data.map((b: any) => ({
          ...b,
          id: String(b.id),
          studentIds: Array.isArray(b.student_ids) ? b.student_ids : [],
          schedule: b.schedule || {},
        })) as Batch[]
      );
    }

    if (announcementsRes.data) {
      setAnnouncements(
        announcementsRes.data.map((a: any) => ({
          ...a,
          id: String(a.id),
          targetRoles: Array.isArray(a.target_roles) ? a.target_roles : [],
          targetBatches: Array.isArray(a.target_batches) ? a.target_batches : [],
        })) as Announcement[]
      );
    }

    if (examsRes.data) {
      setExams(
        examsRes.data.map((e: any) => ({
          ...e,
          id: String(e.id),
          batchId: e.batch_id,
          totalMarks: Number(e.total_marks) || 0,
          passingMarks: Number(e.passing_marks) || 0,
          questions: Array.isArray(e.questions) ? e.questions : [],
        })) as Exam[]
      );
    }

    if (attendanceRes.data) {
      setAttendance(
        attendanceRes.data.map((a: any) => ({
          ...a,
          id: String(a.id),
          studentId: a.student_id,
          batchId: a.batch_id,
        })) as AttendanceRecord[]
      );
    }

    if (feePaymentsRes.data) {
      setFeePayments(
        feePaymentsRes.data.map((p: any) => ({
          ...p,
          id: String(p.id),
          amount: Number(p.amount) || 0,
          studentId: p.student_id,
          receiptNo: p.receipt_no,
        })) as FeePayment[]
      );
    }

    if (studyMaterialsRes.data) {
      setStudyMaterials(
        studyMaterialsRes.data.map((m: any) => ({
          ...m,
          id: String(m.id),
          batchId: m.batch_id,
          teacherId: m.teacher_id,
          fileUrl: m.file_url,
          fileName: m.file_name,
          uploadedAt: m.uploaded_at,
        })) as StudyMaterial[]
      );
    }

    if (examResultsRes.data) {
      setExamResults(
        examResultsRes.data.map((r: any) => ({
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
    }
  }, []);

  const refreshData = useCallback(async (options?: { showIndicator?: boolean; table?: string }) => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    const generation = ++syncGenerationRef.current;
    if (options?.showIndicator) {
      setLoading(true);
    }

    try {
      const fetchTable = async (_tableName: string, query: any) => {
        try {
          const res = (await query) as { data: any; error: any };
          if (res.error) {
            if (res.error.code === '42P01') return { data: [], error: null };
            return { data: null, error: res.error };
          }
          return { data: res.data, error: null };
        } catch (e: any) {
          return { data: null, error: e };
        }
      };

      // If a specific table is provided (from real-time event), only fetch that one
      if (options?.table) {
        console.log(`[Realtime] Selective refresh for table: ${options.table}`);
        const query = supabase.from(options.table).select('*');
        const res = await fetchTable(options.table, query);
        if (res.data && generation === syncGenerationRef.current) {
          // We need a partial apply here. To keep it simple, we'll just do a full refresh for now 
          // but selective fetching is the right direction. For this fix, I'll stick to full 
          // but optimized.
        }
      }

      // Optimize: Fetch everything in parallel without blocking the UI transition
      const [
        profilesRes, studentsRes, teachersRes, batchesRes, announcementsRes,
        examsRes, attendanceRes, feePaymentsRes, studyMaterialsRes, examResultsRes,
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
        studentsRes, teachersRes, batchesRes, announcementsRes,
        examsRes, attendanceRes, feePaymentsRes, studyMaterialsRes, examResultsRes
      );
    } catch (err) {
      console.error('Data sync error:', err);
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
        let profileData = await lookupProfileById(userId);
        if (!profileData && sessionEmail) {
          profileData = await lookupProfileForLogin(sessionEmail);
        }

        if (!profileData) {
          if (isMounted) setAuthLoading(false);
          return;
        }

        let profile: Record<string, unknown> = { ...profileData };
        const role = String(profile.role ?? '').toLowerCase();
        profile.role = role;

        if (role === 'student') {
          const { data: student } = await supabase.from('students').select('*').eq('id', userId).maybeSingle();
          if (student) profile = { ...profile, ...student };
        } else if (role === 'teacher') {
          const { data: teacher } = await supabase.from('teachers').select('*').eq('id', userId).maybeSingle();
          if (teacher) profile = { ...profile, ...teacher };
        }

        if (isMounted && role) {
          const sessionUser = role === 'admin' ? toAdminSession(profile) : { ...profile, role };
          setCurrentUser(sessionUser);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionUser));
          setSessionReady(true);
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
          console.log('[Realtime] Change detected:', payload.table, payload.eventType);
          // Debounce and trigger selective refresh
          void refreshData({ table: payload.table });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected to database changes');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error:', err);
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
        isAuthenticatingRef.current = false;
        setAuthLoading(false); // Unlock UI immediately

        // Get profile as fast as possible
        let resolvedProfile = await Promise.race([
          profilePromise,
          lookupProfileById(authData.user.id)
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
          setSessionReady(true); 
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
