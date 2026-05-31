import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord } from '../../types';
import { Badge } from '../shared/Badge';
import { PageHeader } from '../shared/PageHeader';
import { CheckCircle2, XCircle, Save, Users, ChevronDown, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export const AttendanceMarker: React.FC = () => {
  const { currentUser, batches, students, attendance, setAttendance } = useApp();
  const teacher = currentUser;

  const myBatches = batches.filter(b => 
    b.teacherIds.includes(teacher.id) || 
    (teacher.assignedCategories && teacher.assignedCategories.includes(b.name))
  );
  const [selectedBatch, setSelectedBatch] = useState(myBatches[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const batch = batches.find(b => b.id === selectedBatch);
  const batchStudents = React.useMemo(() => {
    return students.filter(s => batch?.studentIds.includes(s.id));
  }, [students, batch]);

  const existingRecord = attendance.find(
    a => a.batchId === selectedBatch && a.date === selectedDate && a.teacherId === teacher.id
  );

  const initPresentMap = React.useCallback((batchId: string, date: string) => {
    const existing = attendance.find(a => a.batchId === batchId && a.date === date && a.teacherId === teacher.id);
    if (existing) {
      const map: Record<string, boolean> = {};
      existing.records.forEach(r => { map[r.studentId] = r.present; });
      return map;
    }
    const map: Record<string, boolean> = {};
    const targetBatch = batches.find(b => b.id === batchId);
    const batchSts = students.filter(s => targetBatch?.studentIds.includes(s.id));
    batchSts.forEach(s => { map[s.id] = true; });
    return map;
  }, [attendance, students, batches, teacher.id]);

  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(batchId);
    setSaved(false);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSaved(false);
  };

  // Sync presentMap whenever batch or date changes
  React.useEffect(() => {
    if (selectedBatch) {
      setPresentMap(initPresentMap(selectedBatch, selectedDate));
    }
  }, [selectedBatch, selectedDate, initPresentMap]);

  const toggle = (studentId: string) => {
    setPresentMap(prev => ({ ...prev, [studentId]: !prev[studentId] }));
    setSaved(false);
  };

  const markAll = (present: boolean) => {
    const map: Record<string, boolean> = {};
    batchStudents.forEach(s => { map[s.id] = present; });
    setPresentMap(map);
    setSaved(false);
  };

  const handleSave = () => {
    const records = batchStudents.map(s => ({ studentId: s.id, present: presentMap[s.id] ?? true }));
    const newRecord: AttendanceRecord = {
      id: existingRecord?.id || `att${Date.now()}`,
      batchId: selectedBatch,
      date: selectedDate,
      subject: teacher.subject,
      teacherId: teacher.id,
      records,
    };

    if (existingRecord) {
      setAttendance(prev => prev.map(a => a.id === existingRecord.id ? newRecord : a));
    } else {
      setAttendance(prev => [...prev, newRecord]);
    }
    setSaved(true);
  };

  const presentCount = Object.values(presentMap).filter(Boolean).length;
  const absentCount = batchStudents.length - presentCount;

  const recentRecords = attendance
    .filter(a => a.batchId === selectedBatch && a.teacherId === teacher.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Tracker"
        subtitle={`Record daily presence for ${teacher.subject} classes`}
        action={{
          label: saved ? 'Saved ✅' : 'Save Changes',
          icon: <Save size={18} />,
          onClick: handleSave,
          color: saved ? 'green' : 'blue'
        }}
      />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Select Batch</label>
            <div className="relative">
              <Users size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={selectedBatch} onChange={e => handleBatchChange(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-10 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all">
                {myBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Session Date</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="date" value={selectedDate} onChange={e => handleDateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats & Bulk Actions */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400">Total</p>
          <p className="font-bold text-slate-700">{batchStudents.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xs text-green-500">Present</p>
          <p className="font-bold text-green-600">{presentCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-xs text-red-400">Absent</p>
          <p className="font-bold text-red-500">{absentCount}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => markAll(true)}
          className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-xl text-sm font-semibold transition-colors border border-green-100">
          ✅ Mark All Present
        </button>
        <button onClick={() => markAll(false)}
          className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-2 rounded-xl text-sm font-semibold transition-colors border border-red-100">
          ❌ Mark All Absent
        </button>
      </div>

      {/* Student List */}
      <div className={batchStudents.length === 0 ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3"}>
        {batchStudents.length === 0 ? (
          <div className="text-center py-10">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400 text-sm">No students in this batch</p>
          </div>
        ) : (
          batchStudents.map(student => {
            const isPresent = presentMap[student.id] ?? true;
            return (
              <div key={student.id}
                onClick={() => toggle(student.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${isPresent
                    ? 'bg-green-50 border-green-100'
                    : 'bg-red-50 border-red-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isPresent ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${isPresent ? 'text-green-800' : 'text-red-800'}`}>{student.name}</p>
                    <p className="text-xs opacity-60">{student.studentId}</p>
                  </div>
                </div>
                {isPresent ? (
                  <CheckCircle2 size={20} className="text-green-600" />
                ) : (
                  <XCircle size={20} className="text-red-600" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Save Button */}
      {batchStudents.length > 0 && (
        <button onClick={handleSave}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${saved
              ? 'bg-green-100 text-green-700 border-2 border-green-200'
              : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200'
            }`}>
          {saved ? <><CheckCircle2 size={18} /> Attendance Saved!</> : <><Save size={18} /> Save Attendance</>}
        </button>
      )}

      {/* Recent Records */}
      {recentRecords.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Recent Records</h3>
          <div className="space-y-2">
            {recentRecords.map(record => {
              const presentCnt = record.records.filter(r => r.present).length;
              const total = record.records.length;
              return (
                <div key={record.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{format(new Date(record.date), 'dd MMM, yyyy')}</p>
                    <p className="text-xs text-slate-400">{batch?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color="green">{presentCnt}P</Badge>
                    <Badge color="red">{total - presentCnt}A</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
