import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PageHeader } from '../shared/PageHeader';
import { Crown } from 'lucide-react';
import { Badge } from '../shared/Badge';

export const Leaderboard: React.FC = () => {
  const { currentUser, students, examResults } = useApp();
  const student = currentUser;
  const [view, setView] = useState<'batch' | 'overall'>('batch');

  const batchStudents = view === 'batch'
    ? students.filter(s => s.batchId === student.batchId)
    : students;

  const getStudentAvgScore = (studentId: string) => {
    const results = examResults.filter(r => r.studentId === studentId);
    if (results.length === 0) return 0;
    return Math.round(results.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / results.length);
  };

  const ranked = [...batchStudents]
    .map(s => ({ ...s, avgScore: getStudentAvgScore(s.id) || s.performanceScore }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const myRank = ranked.findIndex(s => s.id === student.id) + 1;

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-amber-500';
    if (rank === 2) return 'from-slate-300 to-slate-400';
    if (rank === 3) return 'from-amber-600 to-amber-700';
    return 'from-blue-400 to-blue-500';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hall of Fame"
        subtitle="Celebrating academic excellence across the academy"
      />

      {/* View Toggle */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm flex gap-1.5">
        <button onClick={() => setView('batch')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${view === 'batch' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
          My Batch
        </button>
        <button onClick={() => setView('overall')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${view === 'overall' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
          Overall Rankings
        </button>
      </div>

      {/* My Rank Hero Banner */}
      <div className={`rounded-3xl p-6 text-white relative overflow-hidden shadow-xl ${myRank <= 3 ? 'bg-gradient-to-r from-yellow-500 via-amber-600 to-orange-600 shadow-amber-100' : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 shadow-blue-100'}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Your Performance</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black">#{myRank}</span>
              <span className="text-sm font-bold opacity-80">of {ranked.length}</span>
            </div>
            <div className="mt-4 flex gap-3">
              <div className="bg-white/20 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10">
                <span className="text-xs opacity-80 block leading-none mb-1">Avg Score</span>
                <span className="font-bold">{ranked.find(s => s.id === student.id)?.avgScore || 0}%</span>
              </div>
            </div>
          </div>
          <div className="text-6xl drop-shadow-lg">
            {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🚀'}
          </div>
        </div>
      </div>

      {/* Top 3 podium */}
      {ranked.length >= 3 && (
        <div className="grid grid-cols-3 gap-2">
          {/* 2nd */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center mt-4">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full mx-auto flex items-center justify-center text-white font-bold mb-1.5">
              {ranked[1]?.name.charAt(0)}
            </div>
            <p className="text-xs font-semibold text-slate-700 truncate">{ranked[1]?.name.split(' ')[0]}</p>
            <p className="text-sm font-bold text-slate-600">{ranked[1]?.avgScore}%</p>
            <p className="text-xs text-slate-400">🥈 2nd</p>
          </div>
          {/* 1st */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 text-center ring-2 ring-yellow-300">
            <Crown size={16} className="mx-auto text-yellow-500 mb-1" />
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg mb-1.5">
              {ranked[0]?.name.charAt(0)}
            </div>
            <p className="text-xs font-semibold text-slate-700 truncate">{ranked[0]?.name.split(' ')[0]}</p>
            <p className="text-sm font-bold text-yellow-600">{ranked[0]?.avgScore}%</p>
            <p className="text-xs text-yellow-500">🏆 1st</p>
          </div>
          {/* 3rd */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center mt-4">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full mx-auto flex items-center justify-center text-white font-bold mb-1.5">
              {ranked[2]?.name.charAt(0)}
            </div>
            <p className="text-xs font-semibold text-slate-700 truncate">{ranked[2]?.name.split(' ')[0]}</p>
            <p className="text-sm font-bold text-amber-700">{ranked[2]?.avgScore}%</p>
            <p className="text-xs text-amber-500">🥉 3rd</p>
          </div>
        </div>
      )}

      {/* Full Rankings */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-3 border-b border-slate-50 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">Full Rankings</p>
          <p className="text-xs text-slate-400">{ranked.length} students</p>
        </div>
        <div className="divide-y divide-slate-50">
          {ranked.map((s, idx) => {
            const rank = idx + 1;
            const isMe = s.id === student.id;
            return (
              <div key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMe ? 'bg-blue-50' : ''}`}>
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getMedalColor(rank)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {rank}
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? 'text-blue-700' : 'text-slate-800'}`}>
                    {s.name} {isMe && <span className="text-xs text-blue-500">(You)</span>}
                  </p>
                  <p className="text-xs text-slate-400">{s.attendancePercent}% attendance</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${s.avgScore >= 80 ? 'text-green-600' : s.avgScore >= 60 ? 'text-blue-600' : 'text-red-500'}`}>
                    {s.avgScore}%
                  </p>
                  <Badge color={view === 'overall' ? 'blue' : 'gray'}>{s.stream}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
