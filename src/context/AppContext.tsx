import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial } from '../types';
import {
  mockStudents, mockTeachers, adminUser, mockBatches, mockAttendance,
  mockExams, mockExamResults, mockFeePayments, mockAnnouncements, mockStudyMaterials
} from '../data/mockData';
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<(User & any) | null>(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [teachers, setTeachers] = useState<Teacher[]>(mockTeachers);
  const [batches, setBatches] = useState<Batch[]>(mockBatches);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(mockAttendance);
  const [exams, setExams] = useState<Exam[]>(mockExams);
  const [examResults, setExamResults] = useState<ExamResult[]>(mockExamResults);
  const [feePayments, setFeePayments] = useState<FeePayment[]>(mockFeePayments);
  const [announcements, setAnnouncements] = useState<Announcement[]>(mockAnnouncements);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>(mockStudyMaterials);
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
        const [
          { data: studentsData },
          { data: teachersData },
          { data: batchesData },
          { data: announcementsData },
          { data: examsData },
          { data: attendanceData }
        ] = await Promise.all([
          supabase.from('students_view').select('*'),
          supabase.from('teachers').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('announcements').select('*').order('created_at', { ascending: false }),
          supabase.from('exams').select('*').order('scheduled_at', { ascending: false }),
          supabase.from('attendance').select('*')
        ]);

        if (studentsData) setStudents(studentsData);
        if (teachersData) setTeachers(teachersData);
        if (batchesData) setBatches(batchesData);
        if (announcementsData) setAnnouncements(announcementsData);
        if (examsData) setExams(examsData);
        if (attendanceData) setAttendance(attendanceData);

      } catch (err) {
        console.error('Error fetching data from Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time Subscriptions for cross-device sync
    const announcementsChannel = supabase
      .channel('public:announcements')
      .on('postgres_changes', { event: '*', table: 'announcements', schema: 'public' }, () => fetchData())
      .subscribe();

    const examsChannel = supabase
      .channel('public:exams')
      .on('postgres_changes', { event: '*', table: 'exams', schema: 'public' }, () => fetchData())
      .subscribe();

    const attendanceChannel = supabase
      .channel('public:attendance')
      .on('postgres_changes', { event: '*', table: 'attendance', schema: 'public' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(announcementsChannel);
      supabase.removeChannel(examsChannel);
      supabase.removeChannel(attendanceChannel);
    };
  }, [currentUser]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Maintain Admin login logic for now
    if (email === adminUser.email && password === adminUser.password) {
      setCurrentUser(adminUser);
      setActiveTab('dashboard');
      return true;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;

      // Fetch user profile role from 'profiles' table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentUser(profile);
      setActiveTab('dashboard');
      return true;
    } catch (err) {
      console.error('Login error:', err);
      // Fallback to local check if Supabase fails or is not yet set up
      const teacher = teachers.find(t => t.email === email && t.password === password);
      if (teacher) {
        setCurrentUser(teacher);
        setActiveTab('dashboard');
        return true;
      }
      const student = students.find(s => s.email === email && s.password === password);
      if (student) {
        setCurrentUser(student);
        setActiveTab('dashboard');
        return true;
      }
      return false;
    }
  }, [students, teachers]);

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
      activeTab, setActiveTab
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
