import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Teacher, SubjectName } from '../../types';
import { Badge } from '../shared/Badge';
import { Modal } from '../shared/Modal';
import { PageHeader } from '../shared/PageHeader';
import { supabase } from '../../lib/supabase';
import { normalizeEmail, normalizePassword } from '../../lib/auth';
import { Plus, Edit2, Trash2, Eye, Search, Users } from 'lucide-react';

const defaultTeacher: Omit<Teacher, 'id' | 'role'> = {
  teacherId: '', name: '', email: '', password: 'teacher123', phone: '',
  subject: 'Physics', assignedCategories: [],
  permissions: ['attendance', 'exams', 'materials']
};

const SUBJECTS: SubjectName[] = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const CATEGORIES = ['11th PCM', '11th PCB', '12th PCM', '12th PCB', 'GAP/DROPPER PCM', 'GAP/DROPPER PCB'];
const PERMISSIONS = ['attendance', 'exams', 'materials', 'announcements'];

export const TeacherManagement: React.FC = () => {
  const { teachers, setTeachers } = useApp();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewTeacher, setViewTeacher] = useState<Teacher | null>(null);
  const [editTeacher, setEditTeacher] = useState<Partial<Teacher> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    const newId = `TCH${String(teachers.length + 1).padStart(3, '0')}`;
    setEditTeacher({ 
      ...defaultTeacher, 
      teacherId: newId, 
      id: crypto.randomUUID() // Use real UUID for Supabase
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (t: Teacher) => {
    setEditTeacher({ ...t });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this teacher?')) {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        setTeachers(prev => prev.filter(t => t.id !== id));
      } catch (err) {
        console.error('Error deleting teacher:', err);
        alert('Failed to delete teacher.');
      }
    }
  };

  const handleSave = async () => {
    if (!editTeacher) return;
    const teacher = editTeacher as Teacher;

    if (teacher.email) {
      teacher.email = normalizeEmail(teacher.email);
    }
    if (teacher.password) {
      teacher.password = normalizePassword(teacher.password);
    }

    try {
      if (isEditing) {
        // 1. Update Profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: teacher.name,
            email: teacher.email,
            phone: teacher.phone,
            password: teacher.password,
          })
          .eq('id', teacher.id);
        
        if (profileError) throw profileError;

        // 2. Update Teacher Metadata
        const { error: teacherError } = await supabase
          .from('teachers')
          .upsert({
            id: teacher.id,
            teacher_id: teacher.teacherId,
            subject: teacher.subject,
            assigned_categories: teacher.assignedCategories,
            permissions: teacher.permissions,
            password: teacher.password // Store password in metadata for now
          });

        if (teacherError) throw teacherError;

        setTeachers(prev => prev.map(t => t.id === teacher.id ? teacher : t));
      } else {
        // 1. Insert Profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            role: 'teacher',
            phone: teacher.phone,
            password: teacher.password,
          });
        
        if (profileError) throw profileError;

        // 2. Insert Teacher Metadata
        const { error: teacherError } = await supabase
          .from('teachers')
          .insert({
            id: teacher.id,
            teacher_id: teacher.teacherId,
            subject: teacher.subject,
            assigned_categories: teacher.assignedCategories,
            permissions: teacher.permissions,
            password: teacher.password // Store password in metadata for now
          });

        if (teacherError) throw teacherError;

        setTeachers(prev => [...prev, { ...teacher, role: 'teacher' }]);
      }
      setShowModal(false);
    } catch (err: any) {
      console.error('Error saving teacher:', err);
      const errorMessage = err?.message || 'Unknown database error';
      alert(`Failed to save teacher to database: ${errorMessage}`);
    }
  };

  const toggleCategory = (cat: string) => {
    setEditTeacher(prev => {
      const cats = prev?.assignedCategories || [];
      return { ...prev, assignedCategories: cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat] };
    });
  };

  const togglePermission = (perm: string) => {
    setEditTeacher(prev => {
      const perms = prev?.permissions || [];
      return { ...prev, permissions: perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm] };
    });
  };

  const subjectColors: Record<string, 'blue' | 'green' | 'orange' | 'purple'> = {
    Physics: 'blue', Chemistry: 'green', Mathematics: 'orange', Biology: 'purple'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Management"
        subtitle={`${teachers.length} professional educators on board`}
        action={{
          label: 'Add Teacher',
          icon: <Plus size={18} />,
          onClick: handleAdd,
          color: 'purple'
        }}
      />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, subject or email..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all text-slate-800" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(teacher => (
          <div key={teacher.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
                  {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{teacher.name}</p>
                  <p className="text-xs text-slate-400">{teacher.teacherId} • {teacher.email}</p>
                  <p className="text-xs text-slate-400">📱 {teacher.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setViewTeacher(teacher)}
                  className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                  <Eye size={14} />
                </button>
                <button onClick={() => handleEdit(teacher)}
                  className="p-1.5 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(teacher.id)}
                  className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <Badge color={subjectColors[teacher.subject]}>{teacher.subject}</Badge>
              {teacher.assignedCategories.map(c => (
                <Badge key={c} color="gray">{c}</Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {teacher.permissions.map(p => (
                <span key={p} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full capitalize">{p}</span>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />...
            <p className="text-slate-400 font-medium">No teachers found</p>
          </div>
        )}
      </div>

      {/* View Modal */}
      <Modal isOpen={!!viewTeacher} onClose={() => setViewTeacher(null)} title="Teacher Profile">
        {viewTeacher && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
                {viewTeacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">{viewTeacher.name}</h3>
                <p className="text-slate-500 text-sm">{viewTeacher.teacherId}</p>
                <Badge color={subjectColors[viewTeacher.subject]}>{viewTeacher.subject}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-semibold text-slate-700">{viewTeacher.email}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400">Phone</p>
                <p className="text-sm font-semibold text-slate-700">{viewTeacher.phone}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400">Assigned Batches</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {viewTeacher.assignedCategories.map(c => <Badge key={c} color="gray">{c}</Badge>)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400">Permissions</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {viewTeacher.permissions.map(p => (
                    <span key={p} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditTeacher(null); }}
        title={isEditing ? 'Edit Teacher' : 'Add New Teacher'} size="lg">
        {editTeacher && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Dr. Rahul Patil', full: true },
                { key: 'teacherId', label: 'Teacher ID', type: 'text', placeholder: 'TCH005' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'teacher@academy.com' },
                { key: 'phone', label: 'Phone', type: 'text', placeholder: '98XXXXXXXX' },
                { key: 'password', label: 'Password', type: 'text', placeholder: 'teacher123' },
              ].map(({ key, label, type, placeholder, full }) => (
                <div key={key} className={full ? 'col-span-2' : ''}>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
                  <input type={type} value={(editTeacher as any)[key] || ''}
                    onChange={e => setEditTeacher(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400 text-slate-800" />
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Subject</label>
              <select value={editTeacher.subject} onChange={e => setEditTeacher(prev => ({ ...prev, subject: e.target.value as SubjectName }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400 text-slate-800">
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-2">Assigned Batches</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => (
                  <label key={cat} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${editTeacher.assignedCategories?.includes(cat) ? 'bg-purple-50 border-purple-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={editTeacher.assignedCategories?.includes(cat) || false}
                      onChange={() => toggleCategory(cat)} className="accent-purple-600" />
                    <span className="text-xs text-slate-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-2">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map(perm => (
                  <label key={perm} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${editTeacher.permissions?.includes(perm) ? 'bg-blue-50 border-blue-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={editTeacher.permissions?.includes(perm) || false}
                      onChange={() => togglePermission(perm)} className="accent-blue-600" />
                    <span className="text-xs text-slate-700 capitalize">{perm}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setEditTeacher(null); }}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl text-sm font-semibold">
                {isEditing ? 'Update Teacher' : 'Add Teacher'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
