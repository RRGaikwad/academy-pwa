import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial } from '../types';
import { supabase } from '../lib/supabase';

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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

const MASTER_ADMIN_EMAIL = 'gaikwadrohan8005@gmail.com';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<(User & any) | null>(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    return savedUser ? JSON.parse(savedUser) : null;
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'dashboard';
  });

  // Sync session only to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  // Supabase Data Fetching & Real-time Subscriptions
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Parallel fetch for speed
        const [
          profilesRes,
          studentsRes,
          teachersRes,
          batchesRes,
          announcementsRes,
          examsRes,
          attendanceRes
        ] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('students').select('*'),
          supabase.from('teachers').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('announcements').select('*').order('created_at', { ascending: false }),
          supabase.from('exams').select('*').order('scheduled_at', { ascending: false }),
          supabase.from('attendance').select('*')
        ]);

        const profiles = profilesRes.data || [];
        
        // 1. Format Students
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

        // 2. Format Teachers
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

        // 3. Format Batches
        if (batchesRes.data) {
          setBatches(batchesRes.data.map(b => ({
            ...b,
            studentIds: b.student_ids || [],
            teacherIds: b.teacher_ids || []
          })));
        }

        // 4. Format Announcements
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

        // 5. Format Exams
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

        // 6. Format Attendance
        if (attendanceRes.data) {
          setAttendance(attendanceRes.data.map(at => ({
            ...at,
            batchId: at.batch_id,
            teacherId: at.teacher_id
          })));
        }

        // Fetch Fee Payments
        const { data: feeData } = await supabase.from('fee_payments').select('*').order('date', { ascending: false });
        if (feeData) {
          setFeePayments(feeData.map(p => ({
            ...p,
            studentId: p.student_id,
            receiptNo: p.receipt_no
          })));
        }

      } catch (err) {
        console.error('Error fetching data from Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to ALL relevant tables for total sync
    const channels = [
      'profiles', 'students', 'teachers', 'batches', 
      'announcements', 'exams', 'attendance', 'fee_payments'
    ].map(table => 
      supabase.channel(`public:${table}`)
        .on('postgres_changes', { event: '*', table, schema: 'public' }, () => fetchData())
        .subscribe()
    );

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentUser]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;

      // 1. Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      // 2. High Security Lock: Check if Admin role is actually the Master Email
      if (profile.role === 'admin' && profile.email !== MASTER_ADMIN_EMAIL) {
        await supabase.auth.signOut();
        console.error('Unauthorized Admin Access Attempt blocked.');
        return false;
      }

      setCurrentUser(profile);
      setActiveTab('dashboard');
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
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
      loading
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
