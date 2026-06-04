import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentManagement } from './components/admin/StudentManagement';
import { TeacherManagement } from './components/admin/TeacherManagement';
import { BatchManagement } from './components/admin/BatchManagement';
import { FeesManagement } from './components/admin/FeesManagement';
import { AnnouncementsPanel } from './components/admin/AnnouncementsPanel';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { AttendanceMarker } from './components/teacher/AttendanceMarker';
import { ExamCreator } from './components/teacher/ExamCreator';
import { TeacherStudentView } from './components/teacher/TeacherStudentView';
import { StudentDashboard } from './components/student/StudentDashboard';
import { ExamPortal } from './components/student/ExamPortal';
import { Leaderboard } from './components/student/Leaderboard';
import { NotificationsPage } from './components/student/NotificationsPage';
import { StudyMaterials } from './components/shared/StudyMaterials';

const AppContent = () => {
  const { currentUser, activeTab, authLoading } = useApp();

  const [showLoadingFallback, setShowLoadingFallback] = useState(false);

  useEffect(() => {
    if (authLoading && !currentUser) {
      const timer = setTimeout(() => {
        setShowLoadingFallback(true);
      }, 8000); // After 8 seconds, show a fallback button
      return () => clearTimeout(timer);
    } else {
      setShowLoadingFallback(false);
    }
  }, [authLoading, currentUser]);

  if (authLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium animate-pulse">Checking your session...</p>
        
        {showLoadingFallback && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-sm text-slate-500 mb-4">Taking longer than usual?</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 transition-colors font-medium"
            >
              Reload Application
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!currentUser) return <Login />;

  const renderContent = () => {
    const role = String(currentUser.role ?? '').toLowerCase();

    // Admin routes
    if (role === 'admin') {
      switch (activeTab) {
        case 'dashboard': return <AdminDashboard />;
        case 'students': return <StudentManagement />;
        case 'teachers': return <TeacherManagement />;
        case 'batches': return <BatchManagement />;
        case 'fees': return <FeesManagement />;
        case 'announcements': return <AnnouncementsPanel />;
        default: return <AdminDashboard />;
      }
    }

    // Teacher routes
    if (role === 'teacher') {
      switch (activeTab) {
        case 'dashboard': return <TeacherDashboard />;
        case 'attendance': return <AttendanceMarker />;
        case 'exams': return <ExamCreator />;
        case 'materials': return <StudyMaterials />;
        case 'announcements': return <AnnouncementsPanel />;
        case 'students': return <TeacherStudentView />;
        default: return <TeacherDashboard />;
      }
    }

    // Student routes
    if (role === 'student') {
      switch (activeTab) {
        case 'dashboard': return <StudentDashboard />;
        case 'exam-portal': return <ExamPortal />;
        case 'leaderboard': return <Leaderboard />;
        case 'materials': return <StudyMaterials />;
        case 'notifications': return <NotificationsPage />;
        default: return <StudentDashboard />;
      }
    }

    return null;
  };

  return (
    <Layout>
      {renderContent()}
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
