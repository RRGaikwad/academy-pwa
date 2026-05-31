import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Announcement } from '../../types';
import { Badge } from '../shared/Badge';
import { Modal } from '../shared/Modal';
import { PageHeader } from '../shared/PageHeader';
import { Plus, Megaphone, Trash2, Bell } from 'lucide-react';
import { format } from 'date-fns';

const typeConfig: Record<string, { color: 'red' | 'blue' | 'orange' | 'green' | 'gray' | 'purple'; emoji: string }> = {
  exam: { color: 'red', emoji: '🚨' },
  holiday: { color: 'blue', emoji: '📅' },
  fees: { color: 'orange', emoji: '💰' },
  general: { color: 'gray', emoji: '📢' },
  result: { color: 'green', emoji: '📊' },
  material: { color: 'purple', emoji: '📚' },
};

export const AnnouncementsPanel: React.FC = () => {
  const { announcements, setAnnouncements, currentUser, batches } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Announcement>>({
    title: '', content: '', type: 'general', targetRole: 'all', targetBatch: ''
  });

  const handleCreate = () => {
    if (!form.title || !form.content) return;
    const newAnn: Announcement = {
      id: `a${Date.now()}`,
      title: form.title!,
      content: form.content!,
      authorId: currentUser!.id,
      authorName: currentUser!.name,
      targetRole: form.targetRole as any || 'all',
      targetBatch: form.targetBatch,
      createdAt: new Date().toISOString(),
      type: form.type as any || 'general',
    };
    setAnnouncements(prev => [newAnn, ...prev]);
    setShowModal(false);
    setForm({ title: '', content: '', type: 'general', targetRole: 'all', targetBatch: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this announcement?')) setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const sorted = [...announcements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Broadcast important updates to the academy"
        action={{
          label: 'New Post',
          icon: <Plus size={18} />,
          onClick: () => setShowModal(true),
          color: 'orange'
        }}
      />

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(typeConfig).map(([type, cfg]) => {
          const count = announcements.filter(a => a.type === type).length;
          return (
            <div key={type} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${
              cfg.color === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
              cfg.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              cfg.color === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-200' :
              cfg.color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
              cfg.color === 'purple' ? 'bg-purple-50 text-purple-700 border-purple-200' :
              'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {cfg.emoji} {type} ({count})
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map(ann => {
          const cfg = typeConfig[ann.type] || typeConfig.general;
          return (
            <div key={ann.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-lg leading-none mt-0.5">{cfg.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm leading-tight">{ann.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge color={cfg.color}>{ann.type}</Badge>
                      <Badge color="gray">{ann.targetRole}</Badge>
                      {ann.targetBatch && (
                        <span className="text-xs text-slate-400">
                          {batches.find(b => b.id === ann.targetBatch)?.name || ann.targetBatch}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDelete(ann.id)}
                  className="p-1.5 text-red-400 bg-red-50 rounded-lg hover:bg-red-100 ml-2 flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{ann.content}</p>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <Bell size={10} /> By {ann.authorName} • {format(new Date(ann.createdAt), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          );
        })}

        {announcements.length === 0 && (
          <div className="text-center py-12">
            <Megaphone size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 font-medium">No announcements yet</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Announcement" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. 🚨 Physics Test Scheduled"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 text-slate-800" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Content *</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Announcement details..."
              rows={4} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 text-slate-800 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 text-slate-800">
                <option value="general">General</option>
                <option value="exam">Exam</option>
                <option value="holiday">Holiday</option>
                <option value="fees">Fees</option>
                <option value="result">Result</option>
                <option value="material">Material</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Target</label>
              <select value={form.targetRole} onChange={e => setForm(p => ({ ...p, targetRole: e.target.value as any }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 text-slate-800">
                <option value="all">All</option>
                <option value="students">Students Only</option>
                <option value="teachers">Teachers Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Specific Batch (Optional)</label>
            <select value={form.targetBatch} onChange={e => setForm(p => ({ ...p, targetBatch: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 text-slate-800">
              <option value="">All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowModal(false)}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
            <button onClick={handleCreate}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold">
              Publish
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
