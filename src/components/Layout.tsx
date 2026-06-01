import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  IndianRupee, Megaphone, LogOut, Menu, X, ChevronRight,
  UserCheck, FileText, Trophy, Bell, Layers, Download
} from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  badge?: number;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'teacher', 'student'] },
  { key: 'students', label: 'Students', icon: <GraduationCap size={20} />, roles: ['admin'] },
  { key: 'teachers', label: 'Teachers', icon: <Users size={20} />, roles: ['admin'] },
  { key: 'batches', label: 'Batches', icon: <Layers size={20} />, roles: ['admin'] },
  { key: 'fees', label: 'Fees', icon: <IndianRupee size={20} />, roles: ['admin'] },
  { key: 'announcements', label: 'Announcements', icon: <Megaphone size={20} />, roles: ['admin', 'teacher'] },
  { key: 'attendance', label: 'Attendance', icon: <UserCheck size={20} />, roles: ['teacher'] },
  { key: 'exams', label: 'MCQ Exams', icon: <ClipboardList size={20} />, roles: ['teacher'] },
  { key: 'materials', label: 'Study Materials', icon: <FileText size={20} />, roles: ['teacher', 'student'] },
  { key: 'exam-portal', label: 'Exam Portal', icon: <BookOpen size={20} />, roles: ['student'] },
  { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} />, roles: ['student'] },
  { key: 'notifications', label: 'Notifications', icon: <Bell size={20} />, roles: ['student'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout, activeTab, setActiveTab, announcements } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const userNav = navItems.filter(n => n.roles.includes(currentUser?.role || ''));
  const unreadCount = announcements.filter(a => a.targetRole === 'all' || a.targetRole === 'students').length;

  const roleColors: Record<string, string> = {
    admin: 'from-purple-600 to-indigo-700',
    teacher: 'from-blue-600 to-indigo-700',
    student: 'from-green-600 to-teal-700',
  };

  const roleLabels: Record<string, string> = {
    admin: '🔑 Administrator',
    teacher: '👨‍🏫 Teacher',
    student: '🎓 Student',
  };

  const handleNav = (key: string) => {
    setActiveTab(key);
    setDrawerOpen(false);
  };

  const SidebarContent = () => {
    const { isInstallable, installApp } = useApp();
    
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Drawer Header */}
        <div className={`bg-gradient-to-br ${roleColors[currentUser?.role || 'student']} p-5 text-white`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-2xl font-bold">VidyaSphere</div>
              <div className="text-white/70 text-xs mt-0.5">JEE • NEET Coaching CMS</div>
            </div>
            <button onClick={() => setDrawerOpen(false)}
              className="text-white/60 hover:text-white p-1 lg:hidden">
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
              {currentUser?.name?.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-white">{currentUser?.name}</p>
              <p className="text-white/70 text-xs">{roleLabels[currentUser?.role || '']}</p>
              <p className="text-white/60 text-xs mt-0.5">{currentUser?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3">
          {userNav.map(item => (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all ${activeTab === item.key
                  ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
            >
              <span className={activeTab === item.key ? 'text-blue-600' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.key === 'notifications' && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
              <ChevronRight size={14} className="text-slate-300" />
            </button>
          ))}
        </nav>

        {/* Install & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          {isInstallable && (
            <button
              onClick={installApp}
              className="w-full flex items-center gap-3 px-4 py-3 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-semibold transition-colors"
            >
              <Download size={18} />
              Install App
            </button>
          )}
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-semibold transition-colors">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-100 flex-col sticky top-0 h-screen z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 bg-white h-full flex flex-col shadow-2xl z-10">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors lg:hidden">
              <Menu size={20} />
            </button>
            <div>
              <h1 className="font-bold text-slate-800 text-sm lg:text-lg leading-tight">VidyaSphere</h1>
              <p className="text-slate-400 text-xs">JEE • NEET CMS</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-700">{currentUser?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{currentUser?.role} Account</p>
            </div>
            <div className={`w-10 h-10 bg-gradient-to-br ${roleColors[currentUser?.role || 'student']} rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm`}>
              {currentUser?.name?.charAt(0) || '?'}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 shadow-lg z-20 lg:hidden">
          <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
            {userNav.slice(0, 5).map(item => (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative ${activeTab === item.key
                    ? 'text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <span className={`transition-transform ${activeTab === item.key ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-xs font-medium leading-none">{item.label.split(' ')[0]}</span>
                {activeTab === item.key && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};
