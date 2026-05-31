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
  const { currentUser, activeTab, loading } = useApp();

  if (!currentUser) return <Login />;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium animate-pulse">Syncing your data...</p>
      </div>
    );
  }

  const renderContent = () => {
    const { role } = currentUser;

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
