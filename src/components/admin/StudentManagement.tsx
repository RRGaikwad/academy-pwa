import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Student, Category, Stream } from '../../types';
import { Badge } from '../shared/Badge';
import { Modal } from '../shared/Modal';
import { PageHeader } from '../shared/PageHeader';
import { supabase } from '../../lib/supabase';
import { normalizeEmail, normalizePassword } from '../../lib/auth';
import {
  Plus, Search, Edit2, Trash2, Eye,
  GraduationCap, ChevronDown
} from 'lucide-react';

const defaultStudent: Omit<Student, 'id' | 'role'> = {
  studentId: '', name: '', email: '', password: '', phone: '',
  parentName: '', parentPhone: '', category: '11th', stream: 'PCM',
  subjects: ['Physics', 'Chemistry', 'Mathematics'],
  admissionDate: new Date().toISOString().split('T')[0],
  totalFees: 75000, paidFees: 0, attendancePercent: 0,
  performanceScore: 0, notes: '', batchId: ''
};

export const StudentManagement: React.FC = () => {
  const { students, setStudents, batches, setBatches } = useApp();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStream, setFilterStream] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [editStudent, setEditStudent] = useState<Partial<Student> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{ email: string; pass: string } | null>(null);

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || s.category === filterCategory;
    const matchStream = filterStream === 'all' || s.stream === filterStream;
    return matchSearch && matchCat && matchStream;
  });

  const handleAdd = () => {
    const studentCount = students.length + 1;
    const newId = `STU${String(studentCount).padStart(3, '0')}`;
    const randomPass = Math.random().toString(36).slice(-8);
    const generatedEmail = `student${studentCount}@academy.com`;

    setEditStudent({ 
      ...defaultStudent, 
      studentId: newId, 
      id: crypto.randomUUID(), // Use real UUID for Supabase
      email: generatedEmail,
      password: randomPass
    });
    setGeneratedCreds({ email: generatedEmail, pass: randomPass });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (s: Student) => {
    setEditStudent({ ...s });
    setGeneratedCreds(null);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this student?')) {
      try {
        const studentToDelete = students.find(s => s.id === id);
        
        // Delete from Supabase (profiles table will cascade if set up, but let's be safe)
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;

        setStudents(prev => prev.filter(s => s.id !== id));
        
        // Also remove student from batch
        if (studentToDelete?.batchId) {
          setBatches(prev => prev.map(b => b.id === studentToDelete.batchId ? {
            ...b,
            studentIds: b.studentIds.filter(sid => sid !== id)
          } : b));
        }
      } catch (err) {
        console.error('Error deleting student:', err);
        alert('Failed to delete student from database.');
      }
    }
  };

  const handleSave = async () => {
    if (!editStudent) return;
    const student = editStudent as Student;

    if (!student.name || !student.email || !student.password) {
      alert('Please fill all required fields');
      return;
    }

    student.email = normalizeEmail(student.email);
    student.password = normalizePassword(student.password);

    // Auto assign subjects
    if (student.stream === 'PCM') student.subjects = ['Physics', 'Chemistry', 'Mathematics'];
    else student.subjects = ['Physics', 'Chemistry', 'Biology'];
    
    // Find batch
    const batch = batches.find(b => b.category === student.category && b.stream === student.stream);
    if (batch) student.batchId = batch.id;

    try {
      if (isEditing) {
        // 1. Update Profile (Base user info)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: student.name,
            email: student.email,
            phone: student.phone,
            password: student.password,
          })
          .eq('id', student.id);

        if (profileError) throw profileError;

        // 2. Update Student Metadata
        const { error: studentError } = await supabase
          .from('students')
          .upsert({
            id: student.id,
            student_id: student.studentId,
            batch_id: student.batchId,
            parent_name: student.parentName,
            parent_phone: student.parentPhone,
            category: student.category,
            stream: student.stream,
            attendance_percent: student.attendancePercent,
            performance_score: student.performanceScore,
            subjects: student.subjects,
            admission_date: student.admissionDate,
            total_fees: student.totalFees,
            paid_fees: student.paidFees,
            notes: student.notes,
            password: student.password // Store password in metadata for now
          });

        if (studentError) throw studentError;

        setStudents(prev => prev.map(s => s.id === student.id ? student : s));
      } else {
        // 1. Insert Profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: student.id,
            name: student.name,
            email: student.email,
            role: 'student',
            phone: student.phone,
            password: student.password,
          });

        if (profileError) throw profileError;

        // 2. Insert Student Metadata
        const { error: studentError } = await supabase
          .from('students')
          .insert({
            id: student.id,
            student_id: student.studentId,
            batch_id: student.batchId,
            parent_name: student.parentName,
            parent_phone: student.parentPhone,
            category: student.category,
            stream: student.stream,
            attendance_percent: student.attendancePercent,
            performance_score: student.performanceScore,
            subjects: student.subjects,
            admission_date: student.admissionDate,
            total_fees: student.totalFees,
            paid_fees: student.paidFees,
            notes: student.notes,
            password: student.password // Store password in metadata for now
          });

        if (studentError) throw studentError;

        setStudents(prev => [...prev, { ...student, role: 'student' }]);
      }

      // 3. Sync with Batch (Student IDs)
      if (student.batchId) {
        const targetBatch = batches.find(b => b.id === student.batchId);
        if (targetBatch) {
          const newIds = Array.from(new Set([...(targetBatch.studentIds || []), student.id]));
          await supabase.from('batches').update({ student_ids: newIds }).eq('id', student.batchId);
          setBatches(prev => prev.map(b => b.id === student.batchId ? { ...b, studentIds: newIds } : b));
        }
      }
      setShowModal(false);
      setEditStudent(null);
      setGeneratedCreds(null);
    } catch (err: any) {
      console.error('Error saving student:', err);
      const errorMessage = err?.message || 'Unknown database error';
      alert(`Failed to save student to database: ${errorMessage}`);
    }
  };

  const getCategoryBadge = (cat: Category) => {
    const map: Record<Category, 'blue' | 'green' | 'orange'> = { '11th': 'blue', '12th': 'green', 'GAP/DROPPER': 'orange' };
    return map[cat];
  };

  const feePercent = (s: Student) => Math.round((s.paidFees / s.totalFees) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Directory"
        subtitle={`${filtered.length} of ${students.length} students enrolled`}
        action={{
          label: 'Add Student',
          icon: <Plus size={18} />,
          onClick: handleAdd,
          color: 'blue'
        }}
      />

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID or email..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all pr-10">
              <option value="all">All Classes</option>
              <option value="11th">11th Standard</option>
              <option value="12th">12th Standard</option>
              <option value="GAP/DROPPER">GAP/DROPPER</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative flex-1">
            <select value={filterStream} onChange={e => setFilterStream(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all pr-10">
              <option value="all">All Streams</option>
              <option value="PCM">PCM (Engineering)</option>
              <option value="PCB">PCB (Medical)</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Student Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(student => (
          <div key={student.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{student.name}</p>
                  <p className="text-xs text-slate-400">{student.studentId} • {student.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setViewStudent(student)}
                  className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <Eye size={14} />
                </button>
                <button onClick={() => handleEdit(student)}
                  className="p-1.5 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(student.id)}
                  className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <Badge color={getCategoryBadge(student.category)}>{student.category}</Badge>
              <Badge color="purple">{student.stream}</Badge>
              <Badge color={student.attendancePercent >= 75 ? 'green' : 'red'}>
                {student.attendancePercent}% att.
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-slate-400">Score</p>
                <p className="font-bold text-slate-700">{student.performanceScore}%</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-slate-400">Paid</p>
                <p className="font-bold text-green-600">₹{(student.paidFees / 1000).toFixed(0)}K</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-slate-400">Due</p>
                <p className={`font-bold ${student.paidFees < student.totalFees ? 'text-red-500' : 'text-green-500'}`}>
                  ₹{((student.totalFees - student.paidFees) / 1000).toFixed(0)}K
                </p>
              </div>
            </div>

            {/* Fee progress */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Fee Paid</span>
                <span>{feePercent(student)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${feePercent(student) >= 100 ? 'bg-green-500' : feePercent(student) >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(feePercent(student), 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <GraduationCap size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 font-medium">No students found</p>
          </div>
        )}
      </div>

      {/* View Modal */}
      <Modal isOpen={!!viewStudent} onClose={() => setViewStudent(null)} title="Student Details" size="lg">
        {viewStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
                {viewStudent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">{viewStudent.name}</h3>
                <p className="text-slate-500 text-sm">{viewStudent.studentId}</p>
                <div className="flex gap-2 mt-1">
                  <Badge color={getCategoryBadge(viewStudent.category)}>{viewStudent.category}</Badge>
                  <Badge color="purple">{viewStudent.stream}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Email', value: viewStudent.email, icon: '✉️' },
                { label: 'Phone', value: viewStudent.phone, icon: '📱' },
                { label: 'Parent', value: viewStudent.parentName, icon: '👨‍👩‍👦' },
                { label: 'Parent Phone', value: viewStudent.parentPhone, icon: '📞' },
                { label: 'Admission', value: viewStudent.admissionDate, icon: '📅' },
                { label: 'Subjects', value: viewStudent.subjects.join(', '), icon: '📚' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">{icon} {label}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5 break-all">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-500">Attendance</p>
                <p className="text-xl font-bold text-blue-700">{viewStudent.attendancePercent}%</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-500">Performance</p>
                <p className="text-xl font-bold text-green-700">{viewStudent.performanceScore}%</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-xs text-orange-500">Due Fees</p>
                <p className="text-xl font-bold text-orange-700">₹{((viewStudent.totalFees - viewStudent.paidFees) / 1000).toFixed(0)}K</p>
              </div>
            </div>

            {viewStudent.notes && (
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
                <p className="text-xs text-yellow-600 font-medium mb-1">📝 Notes</p>
                <p className="text-sm text-slate-700">{viewStudent.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditStudent(null); setGeneratedCreds(null); }}
        title={isEditing ? 'Edit Student' : 'Add New Student'} size="lg">
        {editStudent && (
          <div className="space-y-3">
            {generatedCreds && !isEditing && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-blue-700 uppercase mb-1">Generated Credentials</p>
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <p className="text-slate-600">Email: <span className="font-mono font-bold">{generatedCreds.email}</span></p>
                    <p className="text-slate-600">Password: <span className="font-mono font-bold">{generatedCreds.pass}</span></p>
                  </div>
                  <Badge color="blue">Auto-Generated</Badge>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Full Name *', type: 'text', placeholder: 'e.g. Arjun Sharma' },
                { key: 'studentId', label: 'Student ID *', type: 'text', placeholder: 'e.g. STU009' },
                { key: 'email', label: 'Email *', type: 'email', placeholder: 'student@email.com' },
                { key: 'password', label: 'Password *', type: 'text', placeholder: 'Access password' },
                { key: 'phone', label: 'Phone', type: 'text', placeholder: '98XXXXXXXX' },
                { key: 'parentName', label: 'Parent Name', type: 'text', placeholder: 'Parent full name' },
                { key: 'parentPhone', label: 'Parent Phone', type: 'text', placeholder: '98XXXXXXXX' },
                { key: 'totalFees', label: 'Total Fees (₹)', type: 'number', placeholder: '75000' },
                { key: 'paidFees', label: 'Paid Fees (₹)', type: 'number', placeholder: '0' },
                { key: 'admissionDate', label: 'Admission Date', type: 'date', placeholder: '' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key} className={key === 'name' || key === 'notes' ? 'col-span-2' : ''}>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
                  <input
                    type={type}
                    value={(editStudent as any)[key] || ''}
                    onChange={e => setEditStudent(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
                <select value={editStudent.category} onChange={e => setEditStudent(prev => ({ ...prev, category: e.target.value as Category }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800">
                  <option value="11th">11th</option>
                  <option value="12th">12th</option>
                  <option value="GAP/DROPPER">GAP/DROPPER</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Stream</label>
                <select value={editStudent.stream} onChange={e => setEditStudent(prev => ({ ...prev, stream: e.target.value as Stream }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800">
                  <option value="PCM">PCM (JEE)</option>
                  <option value="PCB">PCB (NEET)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
              <textarea value={editStudent.notes || ''} onChange={e => setEditStudent(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Internal remarks about this student..." rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800 resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setEditStudent(null); }}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {isEditing ? 'Update Student' : 'Add Student'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
