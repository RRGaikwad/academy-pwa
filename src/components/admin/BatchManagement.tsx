import React from 'react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../shared/Badge';
import { PageHeader } from '../shared/PageHeader';
import { Users, BookOpen, GraduationCap, Plus } from 'lucide-react';

export const BatchManagement: React.FC = () => {
  const { batches, students, teachers } = useApp();

  const categoryOrder = ['11th', '12th', 'GAP/DROPPER'];
  const grouped = categoryOrder.reduce((acc, cat) => {
    acc[cat] = batches.filter(b => b.category === cat);
    return acc;
  }, {} as Record<string, typeof batches>);

  const catColors: Record<string, 'blue' | 'green' | 'orange'> = {
    '11th': 'blue', '12th': 'green', 'GAP/DROPPER': 'orange'
  };
  const streamColors: Record<string, string> = {
    PCM: 'from-blue-500 to-indigo-600',
    PCB: 'from-green-500 to-teal-600'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Structure"
        subtitle={`${batches.length} active batches categorized by class`}
        action={{
          label: 'Create Batch',
          icon: <Plus size={18} />,
          onClick: () => alert('Feature coming soon: Batch creation'),
          color: 'indigo'
        }}
      />

      {categoryOrder.map(category => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-3">
            <Badge color={catColors[category]}>{category}</Badge>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {grouped[category]?.map(batch => {
              const batchStudents = students.filter(s => s.batchId === batch.id);
              const batchTeachers = teachers.filter(t => batch.teacherIds.includes(t.id));
              const avgAttendance = batchStudents.length > 0
                ? Math.round(batchStudents.reduce((s, st) => s + st.attendancePercent, 0) / batchStudents.length)
                : 0;
              const avgScore = batchStudents.length > 0
                ? Math.round(batchStudents.reduce((s, st) => s + st.performanceScore, 0) / batchStudents.length)
                : 0;

              return (
                <div key={batch.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {/* Header */}
                  <div className={`bg-gradient-to-r ${streamColors[batch.stream]} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">{batch.name}</h3>
                        <p className="text-white/70 text-xs mt-0.5">
                          {batch.stream === 'PCM' ? '⚛️ JEE Track' : '🧬 NEET Track'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{batchStudents.length}</div>
                        <div className="text-white/70 text-xs">Students</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                        <p className="text-blue-500 text-xs">Avg Score</p>
                        <p className="font-bold text-blue-700">{avgScore}%</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-2.5 text-center">
                        <p className="text-green-500 text-xs">Attendance</p>
                        <p className={`font-bold ${avgAttendance >= 75 ? 'text-green-700' : 'text-red-600'}`}>{avgAttendance}%</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-2.5 text-center">
                        <p className="text-purple-500 text-xs">Teachers</p>
                        <p className="font-bold text-purple-700">{batchTeachers.length}</p>
                      </div>
                    </div>

                    {/* Subjects */}
                    <div>
                      <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                        <BookOpen size={11} /> Subjects
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {batch.stream === 'PCM'
                          ? ['Physics', 'Chemistry', 'Mathematics'].map(s => (
                            <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                          ))
                          : ['Physics', 'Chemistry', 'Biology'].map(s => (
                            <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                          ))
                        }
                      </div>
                    </div>

                    {/* Faculty */}
                    <div>
                      <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                        <Users size={11} /> Faculty
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {batchTeachers.map(t => (
                          <div key={t.id} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1">
                            <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {t.name.charAt(0)}
                            </div>
                            <span className="text-xs text-slate-700">{t.name.split(' ').pop()}</span>
                            <span className="text-xs text-slate-400">({t.subject})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Students Preview */}
                    {batchStudents.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                          <GraduationCap size={11} /> Students
                        </p>
                        <div className="space-y-1.5">
                          {batchStudents.map(s => (
                            <div key={s.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                  {s.name.charAt(0)}
                                </div>
                                <span className="text-slate-700">{s.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`${s.attendancePercent >= 75 ? 'text-green-500' : 'text-red-500'}`}>
                                  {s.attendancePercent}%
                                </span>
                                <span className="text-slate-400">|</span>
                                <span className="text-blue-500">{s.performanceScore}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
