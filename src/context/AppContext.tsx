import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial } from '../types';
import { supabase } from '../lib/supabase';
import {
  type AcademySessionUser,
  type LoginResult,
  authenticateAdminUser,
  normalizeEmail,
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
}

const AppContext = createContext<AppContextType | null>(null);

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
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'dashboard';
  });

  // Unified Auth State Listener
  useEffect(() => {
    let isMounted = true;

    const syncProfile = async (userId: string, sessionEmail?: string) => {
      try {
        // 1. Try to get profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        let profile = profileData || { id: userId };

        // 1b. Supabase Auth UUID may differ from profiles.id — resolve by email
        if (!profile.role && sessionEmail) {
          const { data: byEmail } = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', normalizeEmail(sessionEmail))
            .maybeSingle();
          if (byEmail) {
            profile = byEmail;
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
        
        // Ensure role is lowercase for consistency
        if (profile.role) {
          profile.role = profile.role.toLowerCase();
        }
        
        if (isMounted && profile.role) {
          const sessionUser =
            profile.role === 'admin'
              ? {
                  id: profile.id,
                  name: profile.name || 'Admin',
                  email: profile.email || '',
                  phone: profile.phone || '',
                  role: 'admin' as const,
                }
              : profile;
          setCurrentUser(sessionUser);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionUser));
        } else if (isMounted) {
          console.warn('User authenticated but no role found in profiles, students, or teachers');
          setCurrentUser(null);
          localStorage.removeItem(STORAGE_KEYS.USER);
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
      const { data: { session } } = await supabase.auth.getSession();
      const cachedUser = parseCachedUser();
      const cachedRole = cachedUser?.role?.toString().toLowerCase();

      // Priority 1: Supabase Session (The most secure/standard way)
      if (session?.user) {
        await syncProfile(session.user.id, session.user.email);
        return;
      }

      // Priority 2: Manual Session Recovery (For Students, Teachers, and Fallback Admins)
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
              setCurrentUser(cachedUser); // Keep cached if restore fails but we have ID
            }
            setAuthLoading(false);
          }
          return;
        }

        if (cachedRole === 'admin') {
          // Verify Admin profile still exists
          const { data: verifyAdmin } = await supabase.from('profiles').select('id').eq('id', cachedUser.id).eq('role', 'admin').maybeSingle();
          if (verifyAdmin && isMounted) {
            setCurrentUser(cachedUser);
            setAuthLoading(false);
            return;
          }
        }
      }

      // Fallback: Clear everything
      if (isMounted) {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.USER);
        setAuthLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        await syncProfile(session.user.id, session.user.email);
      } else if (event === 'SIGNED_OUT') {
        const cached = parseCachedUser();
        const cachedRole = cached?.role?.toString().toLowerCase();
        if (cachedRole === 'student' || cachedRole === 'teacher') {
          if (isMounted) setAuthLoading(false);
          return;
        }
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

  // Supabase Data Fetching & Real-time Subscriptions
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!currentUser) {
        return;
      }

      setLoading(true);
      try {
        // Parallel fetch for speed with error tolerance
        const [
          profilesRes,
          studentsRes,
          teachersRes,
          batchesRes,
          announcementsRes,
          examsRes,
          attendanceRes,
          feePaymentsRes
        ] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('students').select('*'),
          supabase.from('teachers').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('announcements').select('*').order('created_at', { ascending: false }),
          supabase.from('exams').select('*').order('scheduled_at', { ascending: false }),
          supabase.from('attendance').select('*'),
          supabase.from('fee_payments').select('*').order('date', { ascending: false })
        ]);

        if (!isMounted) return;

        const profiles = profilesRes.data || [];
        
        // 1. Format Students (Only if data available)
        if (studentsRes.data) {
          const formatted: Student[] = studentsRes.data.map(s => {
            const p = profiles.find(prof => prof.id === s.id) || {};
            return {
              ...s,
              name: p.name || 'Unknown',
              email: p.email || '',
              phone: p.phone || '',
              role: 'student',
              studentId: s.student_id,
              batchId: s.batch_id,
              parentName: s.parent_name,
              parentPhone: s.parent_phone,
              attendancePercent: Number(s.attendance_percent) || 0,
              performanceScore: Number(s.performance_score) || 0,
              subjects: s.subjects || [],
              admissionDate: s.admission_date || '',
              totalFees: Number(s.total_fees) || 0,
              paidFees: Number(s.paid_fees) || 0,
              notes: s.notes || '',
              password: s.password || ''
            };
          });
          setStudents(formatted);
        }

        // 2. Format Teachers (Only if data available)
        if (teachersRes.data) {
          const formatted: Teacher[] = teachersRes.data.map(t => {
            const p = profiles.find(prof => prof.id === t.id) || {};
            return {
              ...t,
              name: p.name || 'Unknown',
              email: p.email || '',
              phone: p.phone || '',
              role: 'teacher',
              teacherId: t.teacher_id,
              assignedCategories: t.assigned_categories || [],
              permissions: t.permissions || [],
              password: t.password || ''
            };
          });
          setTeachers(formatted);
        }

        // 3. Format Batches (Only if data available)
        if (batchesRes.data) {
          setBatches(batchesRes.data.map(b => ({
            ...b,
            studentIds: b.student_ids || [],
            teacherIds: b.teacher_ids || []
          })));
        }

        // 4. Format Announcements (Available to all roles)
        if (announcementsRes.data) {
          setAnnouncements(announcementsRes.data.map(a => ({
            ...a,
            authorId: a.author_id,
            authorName: a.author_name,
            targetRole: a.target_role,
            targetBatch: a.target_batch,
            createdAt: a.created_at,
            referenceId: a.reference_id
          })));
        }

        // 5. Format Exams (Available to all roles, but RLS will filter rows)
        if (examsRes.data) {
          setExams(examsRes.data.map(e => ({
            ...e,
            teacherId: e.teacher_id,
            batchId: e.batch_id,
            scheduledAt: e.scheduled_at,
            chapterTags: e.chapter_tags || [],
            hasNegativeMarking: e.has_negative_marking
          })));
        }

        // 6. Format Attendance (RLS will filter)
        if (attendanceRes.data) {
          setAttendance(attendanceRes.data.map(at => ({
            ...at,
            batchId: at.batch_id,
            teacherId: at.teacher_id
          })));
        }

        // 7. Format Fee Payments (RLS will filter)
        if (feePaymentsRes.data) {
          setFeePayments(feePaymentsRes.data.map(p => ({
            ...p,
            studentId: p.student_id,
            receiptNo: p.receipt_no
          })));
        }

      } catch (err) {
        console.error('Critical data fetch error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    // Subscribe to tables for targeted sync
    const tables = [
      { name: 'profiles', fetcher: fetchData },
      { name: 'students', fetcher: async () => {
        const { data } = await supabase.from('students').select('*');
        if (data) {
          const { data: profiles } = await supabase.from('profiles').select('*');
          const formatted: Student[] = data.map(s => {
            const p = profiles?.find(prof => prof.id === s.id) || {};
            return {
              ...s,
              name: p.name || 'Unknown',
              email: p.email || '',
              phone: p.phone || '',
              role: 'student',
              studentId: s.student_id,
              batchId: s.batch_id,
              parentName: s.parent_name,
              parentPhone: s.parent_phone,
              attendancePercent: Number(s.attendance_percent) || 0,
              performanceScore: Number(s.performance_score) || 0,
              subjects: s.subjects || [],
              admissionDate: s.admission_date || '',
              totalFees: Number(s.total_fees) || 0,
              paidFees: Number(s.paid_fees) || 0,
              notes: s.notes || '',
              password: s.password || ''
            };
          });
          if (isMounted) setStudents(formatted);
        }
      }},
      { name: 'teachers', fetcher: async () => {
        const { data } = await supabase.from('teachers').select('*');
        if (data) {
          const { data: profiles } = await supabase.from('profiles').select('*');
          const formatted: Teacher[] = data.map(t => {
            const p = profiles?.find(prof => prof.id === t.id) || {};
            return {
              ...t,
              name: p.name || 'Unknown',
              email: p.email || '',
              phone: p.phone || '',
              role: 'teacher',
              teacherId: t.teacher_id,
              assignedCategories: t.assigned_categories || [],
              permissions: t.permissions || [],
              password: t.password || ''
            };
          });
          if (isMounted) setTeachers(formatted);
        }
      }},
      { name: 'batches', fetcher: async () => {
        const { data } = await supabase.from('batches').select('*');
        if (data) {
          if (isMounted) setBatches(data.map(b => ({
            ...b,
            studentIds: b.student_ids || [],
            teacherIds: b.teacher_ids || []
          })));
        }
      }},
      { name: 'announcements', fetcher: async () => {
        const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
        if (data) {
          if (isMounted) setAnnouncements(data.map(a => ({
            ...a,
            authorId: a.author_id,
            authorName: a.author_name,
            targetRole: a.target_role,
            targetBatch: a.target_batch,
            createdAt: a.created_at,
            referenceId: a.reference_id
          })));
        }
      }},
      { name: 'exams', fetcher: async () => {
        const { data } = await supabase.from('exams').select('*').order('scheduled_at', { ascending: false });
        if (data) {
          if (isMounted) setExams(data.map(e => ({
            ...e,
            teacherId: e.teacher_id,
            batchId: e.batch_id,
            scheduledAt: e.scheduled_at,
            chapterTags: e.chapter_tags || [],
            hasNegativeMarking: e.has_negative_marking
          })));
        }
      }},
      { name: 'attendance', fetcher: async () => {
        const { data } = await supabase.from('attendance').select('*');
        if (data) {
          if (isMounted) setAttendance(data.map(at => ({
            ...at,
            batchId: at.batch_id,
            teacherId: at.teacher_id
          })));
        }
      }},
      { name: 'fee_payments', fetcher: async () => {
        const { data } = await supabase.from('fee_payments').select('*').order('date', { ascending: false });
        if (data) {
          if (isMounted) setFeePayments(data.map(p => ({
            ...p,
            studentId: p.student_id,
            receiptNo: p.receipt_no
          })));
        }
      }}
    ];

    const channels = tables.map(table => 
      supabase.channel(`public:${table.name}`)
        .on('postgres_changes', { event: '*', table: table.name, schema: 'public' }, () => table.fetcher())
        .subscribe()
    );

    return () => {
      isMounted = false;
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentUser]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      if (!isSupabaseConfigured()) {
        return { ok: false, reason: 'Supabase not configured.' };
      }

      const cleanEmail = normalizeEmail(email);
      const cleanPassword = password.trim();

      // 1. Fetch profile by email to determine role and get the stored password
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role, password')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (profileError) {
        console.error('Profile lookup error:', profileError);
        return { ok: false, reason: 'Database connection error. Please try again.' };
      }

      if (!profile) {
        return { ok: false, reason: 'Account not found. Please contact the administrator.' };
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
      installApp
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
