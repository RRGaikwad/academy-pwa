import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatCard } from '../shared/StatCard';
import { Users, GraduationCap, BookOpen, IndianRupee, TrendingUp, AlertCircle, CheckCircle2, Clock, RotateCcw, RefreshCcw } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { performanceTrend, batchPerformance } from '../../data/mockData';
import { Badge } from '../shared/Badge';
import { format } from 'date-fns';
import { PageHeader } from '../shared/PageHeader';

export const AdminDashboard: React.FC = () => {
  const { students, teachers, batches, feePayments, announcements, exams, refresh, loading } = useApp();

  const totalRevenue = feePayments.reduce((s, p) => s + p.amount, 0);
  const totalFeesDue = students.reduce((s, st) => s + (st.totalFees - st.paidFees), 0);
  const avgAttendance = students.length > 0 
    ? Math.round(students.reduce((s, st) => s + st.attendancePercent, 0) / students.length)
    : 0;
  const avgPerformance = students.length > 0
    ? Math.round(students.reduce((s, st) => s + st.performanceScore, 0) / students.length)
    : 0;
  const lowAttendance = students.filter(s => s.attendancePercent < 75).length;
  const upcomingExams = exams.filter(e => e.status === 'upcoming').length;

  const feeData = [
    { name: 'Collected', value: totalRevenue },
    { name: 'Pending', value: totalFeesDue },
  ];

  const recentPayments = [...feePayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const handleReset = () => {
    if (confirm('Are you sure you want to clear all data? This will remove all students, teachers, and records, leaving only the admin account. This action cannot be undone.')) {
      if ((window as any).clearAcademyData) {
        (window as any).clearAcademyData();
      } else {
        localStorage.clear();
        window.location.reload();
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        subtitle={`Welcome back! Today is ${format(new Date(), 'EEEE, MMMM d')}`}
      />

      {/* Quick Summary Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-indigo-100 text-sm font-medium opacity-80 uppercase tracking-wider">System Overview</p>
              <h2 className="text-3xl font-bold mt-1">VidyaSphere Academy</h2>
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10">
                  <span className="text-2xl font-bold block leading-none">{students.length}</span>
                  <span className="text-[10px] text-indigo-100 uppercase font-bold tracking-tight">Active Students</span>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10">
                  <span className="text-2xl font-bold block leading-none">{teachers.length}</span>
                  <span className="text-[10px] text-indigo-100 uppercase font-bold tracking-tight">Faculty Members</span>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10">
                  <span className="text-2xl font-bold block leading-none">{batches.length}</span>
                  <span className="text-[10px] text-indigo-100 uppercase font-bold tracking-tight">Batches Running</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
                <p className="text-xs font-bold text-indigo-200 mb-2 uppercase">Platform Status</p>
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm font-bold">All Systems Nominal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total Students" value={students.length} icon={<GraduationCap size={20} className="text-blue-600" />}
          color="text-blue-700" bgColor="bg-blue-50" subtitle="Across all batches" trend={{ value: 12, label: 'this month' }} />
        <StatCard title="Teachers" value={teachers.length} icon={<Users size={20} className="text-purple-600" />}
          color="text-purple-700" bgColor="bg-purple-50" subtitle="Active faculty" />
        <StatCard title="Avg Attendance" value={`${avgAttendance}%`} icon={<CheckCircle2 size={20} className="text-green-600" />}
          color={avgAttendance >= 75 ? 'text-green-700' : 'text-red-700'} bgColor={avgAttendance >= 75 ? 'bg-green-50' : 'bg-red-50'}
          subtitle={`${lowAttendance} students below 75%`} />
        <StatCard title="Avg Performance" value={`${avgPerformance}%`} icon={<TrendingUp size={20} className="text-orange-600" />}
          color="text-orange-700" bgColor="bg-orange-50" trend={{ value: 5, label: 'vs last month' }} />
      </div>

      {/* Revenue Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Fee Collected" value={`₹${(totalRevenue / 100000).toFixed(1)}L`}
          icon={<IndianRupee size={20} className="text-green-600" />} color="text-green-700" bgColor="bg-green-50"
          subtitle="Total collected" />
        <StatCard title="Fees Due" value={`₹${(totalFeesDue / 100000).toFixed(1)}L`}
          icon={<AlertCircle size={20} className="text-red-600" />} color="text-red-700" bgColor="bg-red-50"
          subtitle="Pending collection" />
        <div className="col-span-2 hidden lg:block bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
           <div className="flex items-center justify-between h-full">
              <div>
                <p className="text-slate-500 text-xs font-medium uppercase">Quick Actions</p>
                <div className="flex gap-2 mt-2">
                   <button className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium">Add Student</button>
                   <button 
                     onClick={() => refresh()}
                     disabled={loading}
                     className="bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 hover:bg-slate-200 transition-colors disabled:opacity-50"
                   >
                     <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
                     Sync Data
                   </button>
                   <button 
                     onClick={handleReset}
                     className="bg-red-50 text-red-600 hover:bg-red-100 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                     title="Reset all system data"
                   >
                     <RotateCcw size={12} /> System Reset
                   </button>
                </div>
              </div>
              <div className="text-right">
                 <p className="text-2xl font-bold text-slate-800">{upcomingExams}</p>
                 <p className="text-slate-400 text-xs">Upcoming Exams</p>
              </div>
           </div>
        </div>
      </div>

      {/* Performance Trend Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">Performance Trend (Monthly)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={performanceTrend}>
            <defs>
              <linearGradient id="physGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="chemGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="mathGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[50, 100]} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }} />
            <Area type="monotone" dataKey="physics" stroke="#3b82f6" fill="url(#physGrad)" strokeWidth={2} name="Physics" />
            <Area type="monotone" dataKey="chemistry" stroke="#10b981" fill="url(#chemGrad)" strokeWidth={2} name="Chemistry" />
            <Area type="monotone" dataKey="mathematics" stroke="#f59e0b" fill="url(#mathGrad)" strokeWidth={2} name="Mathematics" />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Batch Performance */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">Batch Performance Overview</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={batchPerformance} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <YAxis dataKey="batch" type="category" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }} />
            <Bar dataKey="avg" name="Avg Score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            <Bar dataKey="attendance" name="Attendance%" fill="#10b981" radius={[0, 4, 4, 0]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Fee Collection Pie */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-2 text-sm">Fee Status</h3>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={feeData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                {feeData.map((_, i) => <Cell key={i} fill={['#10b981', '#ef4444'][i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} formatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}K`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1">
            {feeData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: ['#10b981', '#ef4444'][i] }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-semibold text-slate-800">₹{(d.value / 1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-blue-500" />
              <div>
                <p className="text-xs text-slate-500">Upcoming Exams</p>
                <p className="font-bold text-blue-600">{upcomingExams}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500" />
              <div>
                <p className="text-xs text-slate-500">Low Attendance</p>
                <p className="font-bold text-red-600">{lowAttendance} students</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-green-500" />
              <div>
                <p className="text-xs text-slate-500">Exams Conducted</p>
                <p className="font-bold text-green-600">{exams.filter(e => e.status === 'completed').length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-3">Recent Fee Payments</h3>
        <div className="space-y-2">
          {recentPayments.map(p => {
            const student = students.find(s => s.id === p.studentId);
            return (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <IndianRupee size={12} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{student?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{p.receiptNo} • {p.mode}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">+₹{p.amount.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{format(new Date(p.date), 'MMM d')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Announcements */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-3">Recent Announcements</h3>
        <div className="space-y-2">
          {announcements.slice(0, 3).map(a => {
            const typeColors: Record<string, string> = { exam: 'red', holiday: 'blue', fees: 'orange', general: 'gray', result: 'green' };
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                    <Badge color={typeColors[a.type] as any}>{a.type}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{a.authorName} • {format(new Date(a.createdAt), 'MMM d')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
