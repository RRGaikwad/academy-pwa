import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../shared/Badge';
import { PageHeader } from '../shared/PageHeader';
import { Search, AlertCircle } from 'lucide-react';

export const TeacherStudentView: React.FC = () => {
  const { currentUser, students, batches, examResults, exams } = useApp();
  const teacher = currentUser;
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'attendance' | 'score'>('name');

  const myBatches = batches.filter(b => b.teacherIds.includes(teacher.id));
  const myStudentIds = myBatches.flatMap(b => b.studentIds);
  const myStudents = students.filter(s => myStudentIds.includes(s.id));

  const getStudentScore = (studentId: string) => {
    const myExamIds = exams.filter(e => e.teacherId === teacher.id).map(e => e.id);
    const results = examResults.filter(r => r.studentId === studentId && myExamIds.includes(r.examId));
    if (results.length === 0) return null;
    return Math.round(results.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / results.length);
  };

  const filtered = myStudents
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'attendance') return b.attendancePercent - a.attendancePercent;
      if (sortBy === 'score') return (getStudentScore(b.id) || b.performanceScore) - (getStudentScore(a.id) || a.performanceScore);
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Performance"
        subtitle={`${myStudents.length} students across ${myBatches.length} batches`}
      />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students by name or ID..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all text-slate-800" />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sort By:</span>
          <div className="flex gap-2">
            {[{ key: 'name', label: 'Name' }, { key: 'attendance', label: 'Attendance' }, { key: 'score', label: 'Score' }].map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sortBy === key ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-slate-100">
          <p className="text-xs text-slate-400">Total</p>
          <p className="font-bold text-slate-800">{myStudents.length}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center shadow-sm border border-red-100">
          <p className="text-xs text-red-400">Low Att.</p>
          <p className="font-bold text-red-600">{myStudents.filter(s => s.attendancePercent < 75).length}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center shadow-sm border border-orange-100">
          <p className="text-xs text-orange-400">Low Score</p>
          <p className="font-bold text-orange-600">{myStudents.filter(s => s.performanceScore < 60).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((student, idx) => {
          const score = getStudentScore(student.id) || student.performanceScore;
          const batch = myBatches.find(b => b.studentIds.includes(student.id));
          const hasLowAtt = student.attendancePercent < 75;
          const hasLowScore = score < 60;

          return (
            <div key={student.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${hasLowAtt || hasLowScore ? 'border-orange-200' : 'border-slate-100'}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{student.name}</p>
                      <p className="text-xs text-slate-400">{student.studentId} • {batch?.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {hasLowAtt && <Badge color="red">Low Att.</Badge>}
                      {hasLowScore && <Badge color="orange">Weak</Badge>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Attendance</p>
                      <p className={`text-sm font-bold ${student.attendancePercent >= 75 ? 'text-green-600' : 'text-red-500'}`}>
                        {student.attendancePercent}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Test Score</p>
                      <p className={`text-sm font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-blue-600' : 'text-red-500'}`}>
                        {score}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Fees Due</p>
                      <p className={`text-sm font-bold ${student.paidFees >= student.totalFees ? 'text-green-600' : 'text-orange-500'}`}>
                        ₹{((student.totalFees - student.paidFees) / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>

                  {/* Mini progress bars */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">Attend.</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${student.attendancePercent >= 75 ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ width: `${student.attendancePercent}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">Score</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-blue-400' : 'bg-red-400'}`}
                          style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  </div>

                  {student.notes && (
                    <p className="text-xs text-slate-400 mt-2 italic bg-slate-50 rounded-lg px-2 py-1.5">
                      📝 {student.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10">
            <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400 text-sm">No students found</p>
          </div>
        )}
      </div>
    </div>
  );
};
