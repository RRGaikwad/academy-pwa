import React from 'react';
import { format } from 'date-fns';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../shared/PageHeader';
import { Badge } from '../shared/Badge';
import { Bell, BookOpen, IndianRupee, Calendar, TrendingUp, Megaphone, FileText } from 'lucide-react';

const typeConfig: Record<string, { icon: React.ReactNode; color: 'red' | 'blue' | 'orange' | 'green' | 'gray' | 'purple'; bg: string }> = {
  exam: { icon: <BookOpen size={14} />, color: 'red', bg: 'bg-red-50' },
  holiday: { icon: <Calendar size={14} />, color: 'blue', bg: 'bg-blue-50' },
  fees: { icon: <IndianRupee size={14} />, color: 'orange', bg: 'bg-orange-50' },
  general: { icon: <Megaphone size={14} />, color: 'gray', bg: 'bg-slate-50' },
  result: { icon: <TrendingUp size={14} />, color: 'green', bg: 'bg-green-50' },
  material: { icon: <FileText size={14} />, color: 'purple', bg: 'bg-purple-50' },
};

export const NotificationsPage: React.FC = () => {
  const { announcements, currentUser } = useApp();
  const student = currentUser;

  const myAnnouncements = announcements
    .filter(a => a.targetRole === 'all' || a.targetRole === 'students')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const urgentAlerts = [
    ...(student.attendancePercent < 75 ? [{
      id: 'alert-att', type: 'exam', title: '⚠️ Low Attendance Alert',
      content: `Your attendance is ${student.attendancePercent}%. Minimum 75% required for JEE/NEET eligibility.`,
      color: 'border-red-400 bg-red-50 text-red-800',
    }] : []),
    ...(student.totalFees - student.paidFees > 0 ? [{
      id: 'alert-fees', type: 'fees', title: '💰 Fee Payment Reminder',
      content: `Pending fee: ₹${(student.totalFees - student.paidFees).toLocaleString()}. Please settle this at the office.`,
      color: 'border-orange-400 bg-orange-50 text-orange-800',
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`Stay updated with the latest from the academy`}
      />

      {/* Urgent Alerts Section */}
      {urgentAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
            <p className="text-xs font-black text-red-600 uppercase tracking-widest">Action Required</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentAlerts.map(alert => (
              <div key={alert.id} className={`${alert.color} rounded-2xl p-5 border-l-4 shadow-sm relative overflow-hidden`}>
                <div className="relative z-10">
                  <p className="font-bold text-sm mb-1">{alert.title}</p>
                  <p className="text-xs opacity-90 leading-relaxed">{alert.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Notification Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 mb-1">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent Updates</p>
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
            {myAnnouncements.length} Messages
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {myAnnouncements.map((ann, idx) => {
            const cfg = typeConfig[ann.type] || typeConfig.general;
            const isNew = idx < 2;
            return (
              <div key={ann.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 transition-all hover:shadow-md hover:border-blue-100 group relative ${isNew ? 'ring-2 ring-blue-500/5' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className={`${cfg.bg} p-3 rounded-2xl flex-shrink-0 transition-transform group-hover:scale-110`}>
                    <span className={`${cfg.color === 'red' ? 'text-red-600' : cfg.color === 'blue' ? 'text-blue-600' : cfg.color === 'orange' ? 'text-orange-600' : cfg.color === 'green' ? 'text-green-600' : cfg.color === 'purple' ? 'text-purple-600' : 'text-slate-600'}`}>
                      {cfg.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{ann.title}</p>
                      {isNew && <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg">NEW</span>}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">{ann.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge color={cfg.color}>{ann.type}</Badge>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">
                        {format(new Date(ann.createdAt), 'MMM d, p')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

          {myAnnouncements.length === 0 && (
            <div className="text-center py-12">
              <Bell size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 font-medium">No notifications yet</p>
            </div>
          )}
        </div>
    </div>
  );
};
