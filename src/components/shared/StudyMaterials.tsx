import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StudyMaterial } from '../../types';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { PageHeader } from './PageHeader';
import { FileText, Upload, Download, BookOpen, Search } from 'lucide-react';
import { format } from 'date-fns';

export const StudyMaterials: React.FC = () => {
  const { currentUser, studyMaterials, setStudyMaterials, batches, setAnnouncements } = useApp();
  const isTeacher = currentUser.role === 'teacher';
  const isStudent = currentUser.role === 'student';

  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', chapter: '', batchId: '' });

  const myMaterials = isStudent
    ? studyMaterials.filter(m => m.batchId === currentUser.batchId)
    : isTeacher
      ? studyMaterials.filter(m => m.teacherId === currentUser.id || batches.filter(b => b.teacherIds.includes(currentUser.id)).some(b => b.id === m.batchId))
      : studyMaterials;

  const filtered = myMaterials.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.chapter || '').toLowerCase().includes(search.toLowerCase());
    const matchSubject = filterSubject === 'all' || m.subject === filterSubject;
    return matchSearch && matchSubject;
  });

  const myBatches = isTeacher
    ? batches.filter(b => b.teacherIds.includes(currentUser.id))
    : batches;

  const handleDownload = (material: StudyMaterial) => {
    // In a real app, this would be: window.open(material.fileUrl, '_blank');
    // For this PWA demo, we simulate the download process
    const link = document.createElement('a');
    link.href = 'data:application/pdf;base64,JVBERi0xLjQKJ...' // Dummy PDF content
    link.download = material.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`📥 Downloading: ${material.fileName}\n(Target Batch: ${batches.find(b => b.id === material.batchId)?.name || 'Unknown'})`);
  };

  const handleUpload = () => {
    if (!form.title || !form.batchId) {
      alert('Please provide a title and select a target batch.');
      return;
    }

    const batch = batches.find(b => b.id === form.batchId);
    const materialId = `m${Date.now()}`;
    const fileName = `${form.title.replace(/\s+/g, '_')}.pdf`;

    const newMaterial: StudyMaterial = {
      id: materialId,
      title: form.title,
      subject: currentUser.subject || 'Physics',
      batchId: form.batchId,
      teacherId: currentUser.id,
      fileUrl: '#', // In real app, this would be the URL from cloud storage
      fileName: fileName,
      uploadedAt: new Date().toISOString(),
      chapter: form.chapter,
    };

    // Add to study materials
    setStudyMaterials(prev => [newMaterial, ...prev]);

    // Create a robust notification/announcement for the target batch
    const newAnnouncement = {
      id: `a${Date.now()}`,
      title: `New Study Material: ${form.title}`,
      content: `New study material has been uploaded for ${batch?.name}. Subject: ${currentUser.subject}${form.chapter ? ` | Chapter: ${form.chapter}` : ''}. You can download it from the Study Materials section.`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      targetRole: 'students' as const,
      targetBatch: form.batchId,
      createdAt: new Date().toISOString(),
      type: 'material' as const,
    };

    setAnnouncements(prev => [newAnnouncement, ...prev]);

    setShowUpload(false);
    setForm({ title: '', chapter: '', batchId: '' });
    alert(`📚 Material uploaded and ${batch?.name} students notified!`);
  };

  const subjectColors: Record<string, 'blue' | 'green' | 'orange' | 'purple'> = {
    Physics: 'blue', Chemistry: 'green', Mathematics: 'orange', Biology: 'purple'
  };

  const subjects = ['all', 'Physics', 'Chemistry', 'Mathematics', 'Biology'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Materials"
        subtitle={`${filtered.length} resources available for your batches`}
        action={isTeacher ? {
          label: 'Upload Material',
          icon: <Upload size={18} />,
          onClick: () => setShowUpload(true),
          color: 'green'
        } : undefined}
      />

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search materials..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-400 text-slate-800" />
      </div>

      {/* Subject Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {subjects.map(sub => (
          <button key={sub} onClick={() => setFilterSubject(sub)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterSubject === sub ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {sub === 'all' ? '📚 All' : sub}
          </button>
        ))}
      </div>

      {/* Materials Grid */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 font-medium">No study materials found</p>
          </div>
        ) : filtered.map(material => {
          const batch = batches.find(b => b.id === material.batchId);
          return (
            <div key={material.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  material.subject === 'Physics' ? 'bg-blue-100' :
                  material.subject === 'Chemistry' ? 'bg-green-100' :
                  material.subject === 'Mathematics' ? 'bg-orange-100' : 'bg-purple-100'
                }`}>
                  <FileText size={20} className={
                    material.subject === 'Physics' ? 'text-blue-600' :
                    material.subject === 'Chemistry' ? 'text-green-600' :
                    material.subject === 'Mathematics' ? 'text-orange-600' : 'text-purple-600'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{material.title}</p>
                  {material.chapter && (
                    <p className="text-xs text-slate-400 mt-0.5">📖 {material.chapter}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge color={subjectColors[material.subject] || 'gray'}>{material.subject}</Badge>
                    {batch && <Badge color="gray">{batch.name}</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    📅 {format(new Date(material.uploadedAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <button onClick={() => handleDownload(material)}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex-shrink-0">
                  <Download size={13} /> PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload Study Material">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <Upload size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Click to select a PDF file</p>
            <p className="text-xs text-slate-400 mt-1">Demo mode: File upload simulated</p>
            <button className="mt-3 bg-blue-50 text-blue-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-100">
              Select File
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Current Electricity - Complete Notes"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 text-slate-800" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Chapter</label>
            <input value={form.chapter} onChange={e => setForm(p => ({ ...p, chapter: e.target.value }))}
              placeholder="e.g. Current Electricity"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 text-slate-800" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Target Batch</label>
            <select value={form.batchId} onChange={e => setForm(p => ({ ...p, batchId: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 text-slate-800">
              <option value="">Select batch</option>
              {myBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowUpload(false)}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
            <button onClick={handleUpload}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold">
              Upload Material
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
