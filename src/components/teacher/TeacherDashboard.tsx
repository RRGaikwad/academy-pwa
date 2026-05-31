import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatCard } from '../shared/StatCard';
import { Badge } from '../shared/Badge';
import { Users, ClipboardList, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { PageHeader } from '../shared/PageHeader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const TeacherDashboard: React.FC = () => {
  const { currentUser, students, batches, exams, examResults, attendance, announcements } = useApp();

  const teacher = currentUser;
  const myBatches = batches.filter(b => b.teacherIds.includes(teacher.id));
  const myStudentIds = myBatches.flatMap(b => b.studentIds);
  const myStudents = students.filter(s => myStudentIds.includes(s.id));
  const myExams = exams.filter(e => e.teacherId === teacher.id);
  const myResults = examResults.filter(r => myExams.some(e => e.id === r.examId));

  const avgScore = myResults.length > 0
    ? Math.round(myResults.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / myResults.length)
    : 0;

  const todayAttendance = attendance.filter(a => a.teacherId === teacher.id && isToday(new Date(a.date)));
  const upcomingExams = myExams.filter(e => e.status === 'upcoming');

  const studentPerformance = myStudents.slice(0, 6).map(s => ({
    name: s.name.split(' ')[0],
    score: s.performanceScore,
    attendance: s.attendancePercent,
  }));

  const recentAnnouncements = announcements.filter(a =>
    a.authorId === teacher.id || a.targetRole === 'all' || a.targetRole === 'teachers'
  ).slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Dashboard"
        subtitle={`Welcome, Prof. ${teacher.name.split(' ')[0]}`}
      />

      {/* Teacher Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-purple-100">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative z-10">
          <p className="text-purple-100 text-sm font-medium opacity-80 uppercase tracking-wider">{teacher.subject} Faculty</p>
          <h2 className="text-2xl font-bold mt-1">Ready for today's sessions?</h2>
          <div className="flex gap-2 mt-4 flex-wrap">
            {myBatches.map(b => (
              <span key={b.id} className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10">
                {b.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="My Students" value={myStudents.length}
          icon={<Users size={20} className="text-purple-600" />} color="text-purple-700" bgColor="bg-purple-50"
          subtitle="Across all batches" />
        <StatCard title="Avg Score" value={`${avgScore}%`}
          icon={<TrendingUp size={20} className="text-blue-600" />} color="text-blue-700" bgColor="bg-blue-50"
          subtitle="In my exams" />
        <StatCard title="Exams Created" value={myExams.length}
          icon={<ClipboardList size={20} className="text-orange-600" />} color="text-orange-700" bgColor="bg-orange-50"
          subtitle={`${upcomingExams.length} upcoming`} />
        <StatCard title="Today's Classes" value={todayAttendance.length}
          icon={<CheckCircle2 size={20} className="text-green-600" />} color="text-green-700" bgColor="bg-green-50"
          subtitle="Attendance marked" />
      </div>

      {/* Upcoming Exams */}
      {upcomingExams.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-orange-500" /> Upcoming Exams
          </h3>
          <div className="space-y-2">
            {upcomingExams.map(exam => {
              const batch = batches.find(b => b.id === exam.batchId);
              return (
                <div key={exam.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{exam.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{batch?.name} • {exam.duration} mins • {exam.questions.length} Qs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-orange-600">{format(new Date(exam.scheduledAt), 'MMM d')}</p>
                    <p className="text-xs text-slate-400">{format(new Date(exam.scheduledAt), 'hh:mm a')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Student Performance Chart */}
      {studentPerformance.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">Student Performance</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={studentPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px' }} />
              <Bar dataKey="score" name="Score%" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="attendance" name="Attendance%" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Students needing attention */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-3">⚠️ Students Needing Attention</h3>
        <div className="space-y-2">
          {myStudents.filter(s => s.attendancePercent < 75 || s.performanceScore < 60).map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-200 rounded-lg flex items-center justify-center text-red-700 font-bold text-sm">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.category} {s.stream}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {s.attendancePercent < 75 && <Badge color="red">{s.attendancePercent}% att</Badge>}
                {s.performanceScore < 60 && <Badge color="orange">{s.performanceScore}% score</Badge>}
              </div>
            </div>
          ))}
          {myStudents.filter(s => s.attendancePercent < 75 || s.performanceScore < 60).length === 0 && (
            <p className="text-sm text-green-600 text-center py-3">🎉 All students are performing well!</p>
          )}
        </div>
      </div>

      {/* Recent Announcements */}
      {recentAnnouncements.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">Recent Announcements</h3>
          <div className="space-y-2">
            {recentAnnouncements.map(a => (
              <div key={a.id} className="p-3 bg-slate-50 rounded-xl">
                <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{format(new Date(a.createdAt), 'MMM d, yyyy')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
