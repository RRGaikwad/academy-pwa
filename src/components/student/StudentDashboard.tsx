import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatCard } from '../shared/StatCard';
import { Badge } from '../shared/Badge';
import {
  CheckCircle2, TrendingUp, Bell, IndianRupee, Clock, Trophy
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { format } from 'date-fns';
import { PageHeader } from '../shared/PageHeader';
import { performanceTrend } from '../../data/mockData';

export const StudentDashboard: React.FC = () => {
  const { currentUser, exams, examResults, announcements, batches } = useApp();
  const student = currentUser;

  const myResults = examResults.filter(r => r.studentId === student.id);
  const myExams = exams.filter(e => e.batchId === student.batchId);
  const upcomingExams = myExams.filter(e => e.status === 'upcoming');

  const avgScore = myResults.length > 0
    ? Math.round(myResults.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / myResults.length)
    : student.performanceScore;

  const feesDue = student.totalFees - student.paidFees;
  const feePercent = Math.round((student.paidFees / student.totalFees) * 100);

  const myAnnouncements = announcements.filter(a =>
    a.targetRole === 'all' || a.targetRole === 'students'
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const batch = batches.find(b => b.id === student.batchId);

  const radarData = student.stream === 'PCM' ? [
    { subject: 'Physics', score: student.performanceScore + 5 },
    { subject: 'Chemistry', score: student.performanceScore - 3 },
    { subject: 'Mathematics', score: student.performanceScore + 2 },
    { subject: 'Problem Solving', score: student.performanceScore - 5 },
    { subject: 'Speed', score: student.performanceScore - 8 },
  ] : [
    { subject: 'Physics', score: student.performanceScore - 5 },
    { subject: 'Chemistry', score: student.performanceScore + 2 },
    { subject: 'Biology', score: student.performanceScore + 8 },
    { subject: 'Diagrams', score: student.performanceScore + 4 },
    { subject: 'Memory', score: student.performanceScore + 6 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Portal"
        subtitle={`Academic overview for ${student.name.split(' ')[0]}`}
      />

      {/* Student Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-blue-100">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 border border-white/20 shadow-lg">
            {student.name.charAt(0)}
          </div>
          <div>
            <p className="text-blue-100 text-sm font-medium opacity-80 uppercase tracking-wider">{student.studentId} • {batch?.name}</p>
            <h2 className="text-2xl font-bold mt-1">Keep pushing your limits!</h2>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Badge color={student.stream === 'PCM' ? 'blue' : 'green'}>{student.stream} Track</Badge>
              <Badge color={student.category === '11th' ? 'blue' : student.category === '12th' ? 'green' : 'orange'}>
                Class {student.category}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Attendance" value={`${student.attendancePercent}%`}
          icon={<CheckCircle2 size={20} className={student.attendancePercent >= 75 ? 'text-green-600' : 'text-red-600'} />}
          color={student.attendancePercent >= 75 ? 'text-green-700' : 'text-red-700'}
          bgColor={student.attendancePercent >= 75 ? 'bg-green-50' : 'bg-red-50'}
          subtitle={student.attendancePercent < 75 ? '⚠️ Below 75%!' : 'Good standing'} />
        <StatCard title="Avg Score" value={`${avgScore}%`}
          icon={<TrendingUp size={20} className="text-blue-600" />}
          color="text-blue-700" bgColor="bg-blue-50"
          subtitle={`${myResults.length} tests taken`} />
        <StatCard title="Upcoming Tests" value={upcomingExams.length}
          icon={<Clock size={20} className="text-orange-600" />}
          color="text-orange-700" bgColor="bg-orange-50" subtitle="Scheduled" />
        <StatCard title="Fees Due" value={feesDue > 0 ? `₹${(feesDue / 1000).toFixed(0)}K` : 'Clear!'}
          icon={<IndianRupee size={20} className={feesDue > 0 ? 'text-red-600' : 'text-green-600'} />}
          color={feesDue > 0 ? 'text-red-700' : 'text-green-700'}
          bgColor={feesDue > 0 ? 'bg-red-50' : 'bg-green-50'}
          subtitle={feesDue > 0 ? 'Pay before due date' : '100% paid!'} />
      </div>

      {/* Fee Progress */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-sm">Fee Payment Status</h3>
          <span className={`text-sm font-bold ${feePercent >= 100 ? 'text-green-600' : feePercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {feePercent}% Paid
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${feePercent >= 100 ? 'bg-green-500' : feePercent >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(feePercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
          <span>Paid: ₹{student.paidFees.toLocaleString()}</span>
          <span>Total: ₹{student.totalFees.toLocaleString()}</span>
        </div>
      </div>

      {/* Upcoming Exams */}
      {upcomingExams.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-orange-500" /> Upcoming Exams
          </h3>
          <div className="space-y-2">
            {upcomingExams.map(exam => (
              <div key={exam.id} className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{exam.title}</p>
                  <div className="flex gap-2 mt-1 text-xs text-slate-500">
                    <span>⏱ {exam.duration} mins</span>
                    <span>•</span>
                    <span>📝 {exam.questions.length} Qs</span>
                    {exam.hasNegativeMarking && <><span>•</span><span className="text-red-500">–ve marks</span></>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-bold text-orange-600">{format(new Date(exam.scheduledAt), 'MMM d')}</p>
                  <p className="text-xs text-slate-400">{format(new Date(exam.scheduledAt), 'hh:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Trend Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">Performance Trend</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={performanceTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[50, 100]} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px' }} />
            {student.stream === 'PCM' ? (
              <>
                <Line type="monotone" dataKey="physics" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} name="Physics" />
                <Line type="monotone" dataKey="chemistry" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="Chemistry" />
                <Line type="monotone" dataKey="mathematics" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} name="Maths" />
              </>
            ) : (
              <>
                <Line type="monotone" dataKey="physics" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} name="Physics" />
                <Line type="monotone" dataKey="chemistry" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="Chemistry" />
                <Line type="monotone" dataKey="biology" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} name="Biology" />
              </>
            )}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">Skill Radar</h3>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
            <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Results */}
      {myResults.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" /> Recent Results
          </h3>
          <div className="space-y-2">
            {myResults.slice(0, 3).map(result => {
              const exam = myExams.find(e => e.id === result.examId);
              const pct = Math.round((result.score / result.totalMarks) * 100);
              return (
                <div key={result.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{exam?.title || 'Exam'}</p>
                    <p className="text-xs text-slate-400">
                      {result.score}/{result.totalMarks} • Accuracy: {result.accuracy}%
                      {result.rank && ` • Rank: #${result.rank}`}
                    </p>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1 rounded-xl ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Announcements */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Bell size={16} className="text-blue-500" /> Announcements
        </h3>
        <div className="space-y-2">
          {myAnnouncements.slice(0, 4).map(a => {
            const typeEmojis: Record<string, string> = { exam: '🚨', holiday: '📅', fees: '💰', general: '📢', result: '📊' };
            return (
              <div key={a.id} className="p-3 bg-slate-50 rounded-xl border-l-4 border-blue-400">
                <p className="text-sm font-semibold text-slate-800">{typeEmojis[a.type]} {a.title}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{a.content.substring(0, 100)}...</p>
                <p className="text-xs text-slate-400 mt-1">{format(new Date(a.createdAt), 'MMM d, yyyy')}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
