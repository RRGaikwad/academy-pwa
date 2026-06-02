import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial } from '../types';
import { supabase } from '../lib/supabase';
import {
  type AcademySessionUser,
  type LoginResult,
  normalizeEmail,
  normalizePassword,
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

const MASTER_ADMIN_EMAIL = 'gaikwadrohan8005@gmail.com';

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

    const syncProfile = async (userId: string) => {
      try {
        // 1. Try to get profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        let profile = profileData || { id: userId };

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
          setCurrentUser(profile);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));
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

      // Student/teacher sessions are stored locally (not Supabase Auth)
      if (cachedRole === 'student' || cachedRole === 'teacher') {
        if (session) {
          await supabase.auth.signOut();
        }

        const restored = await restoreAcademyUserById(
          cachedUser!.id,
          cachedRole as 'student' | 'teacher'
        );

        if (isMounted) {
          if (restored) {
            setCurrentUser(restored);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(restored));
          } else if (cachedUser) {
            setCurrentUser(cachedUser);
          } else {
            setCurrentUser(null);
            localStorage.removeItem(STORAGE_KEYS.USER);
          }
          setAuthLoading(false);
        }
        return;
      }

      if (session?.user) {
        await syncProfile(session.user.id);
        return;
      }

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
        await syncProfile(session.user.id);
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
      if (!isSupabaseConfigured()) {
        return {
          ok: false,
          reason:
            'App is not connected to Supabase. Add your Project URL and anon key to `.env`, then restart the dev server.',
        };
      }

      const cleanEmail = normalizeEmail(email);
      const cleanPassword = normalizePassword(password);

      // 1. Check if this is the Master Admin attempting login
      const isMasterAdmin = cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase();

      // 2. Fetch profile if it exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role')
        .ilike('email', cleanEmail)
        .maybeSingle();

      const profileRole = profile?.role?.toLowerCase();

      // 3. Handle Admin Login (Always use Supabase Auth for Admin)
      if (isMasterAdmin || profileRole === 'admin') {
        // If it's a profile-based admin but not the master email, block it for safety
        if (profileRole === 'admin' && cleanEmail !== MASTER_ADMIN_EMAIL.toLowerCase()) {
          return { ok: false, reason: 'Unauthorized admin access attempt.' };
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (authError || !authData.user) {
          const message =
            authError?.message?.includes('Invalid login credentials')
              ? 'Incorrect email or password. Please try again.'
              : 'Admin sign-in failed. Please check your Supabase Auth dashboard.';
          return { ok: false, reason: message };
        }

        // Ensure a profile exists for the Master Admin
        let adminUser = profile;
        if (!adminUser) {
          // Auto-create profile for Master Admin if it doesn't exist
          const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              email: cleanEmail,
              name: 'Master Admin',
              role: 'admin'
            })
            .select()
            .single();
          adminUser = newProfile;
        }

        const user: AcademySessionUser = {
          id: authData.user.id,
          name: adminUser?.name || 'Master Admin',
          email: adminUser?.email || cleanEmail,
          phone: adminUser?.phone || '',
          role: 'admin'
        };
        setCurrentUser(user);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        setActiveTab('dashboard');
        return { ok: true, user };
      }

      // 4. Handle Student/Teacher Login (Direct Database Check)
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
      return { ok: false, reason: 'Login failed due to a connection or server error. Please try again.' };
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
