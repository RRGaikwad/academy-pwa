import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Exam, MCQQuestion, Announcement } from '../../types';
import { Badge } from '../shared/Badge';
import { Modal } from '../shared/Modal';
import { PageHeader } from '../shared/PageHeader';
import { Plus, Trash2, ClipboardList, Timer, ChevronRight, CheckCircle2, Edit3 } from 'lucide-react';
import { format } from 'date-fns';

const emptyQuestion = (): MCQQuestion => ({
  id: `q${Date.now()}`,
  question: '',
  options: ['', '', '', ''],
  correctOption: 0,
  marks: 4,
  negativeMarks: 1,
  chapter: '',
  explanation: '',
});

export const ExamCreator: React.FC = () => {
  const { currentUser, batches, exams, setExams, examResults, setAnnouncements } = useApp();
  const teacher = currentUser;

  const myBatches = batches.filter(b => 
    b.teacherIds.includes(teacher.id) || 
    (teacher.assignedCategories && teacher.assignedCategories.includes(b.name))
  );
  const myExams = exams.filter(e => e.teacherId === teacher.id);

  const [showCreate, setShowCreate] = useState(false);
  const [showResults, setShowResults] = useState<Exam | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const initialFormState = {
    title: '',
    batchId: myBatches[0]?.id || '',
    duration: 45,
    hasNegativeMarking: true,
    scheduledAt: new Date().toISOString().slice(0, 16),
    chapterTags: '',
    questions: [emptyQuestion()],
  };

  const [examForm, setExamForm] = useState(initialFormState);

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setExamForm({
      title: exam.title,
      batchId: exam.batchId,
      duration: exam.duration,
      hasNegativeMarking: exam.hasNegativeMarking,
      scheduledAt: new Date(exam.scheduledAt).toISOString().slice(0, 16),
      chapterTags: exam.chapterTags.join(', '),
      questions: [...exam.questions],
    });
    setShowCreate(true);
    setActiveStep(0);
  };

  const handleDelete = (examId: string) => {
    if (confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      setExams(prev => prev.filter(e => e.id !== examId));
      setAnnouncements(prev => prev.filter(a => a.referenceId !== examId));
    }
  };

  const addQuestion = () => {
    setExamForm(prev => ({ ...prev, questions: [...prev.questions, emptyQuestion()] }));
  };

  const removeQuestion = (idx: number) => {
    setExamForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
  };

  const updateQuestion = (idx: number, updates: Partial<MCQQuestion>) => {
    setExamForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, ...updates } : q)
    }));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setExamForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.options];
        opts[oIdx] = value;
        return { ...q, options: opts };
      })
    }));
  };

  const handleCreateExam = () => {
    const examData: Exam = {
      id: editingExam ? editingExam.id : `e${Date.now()}`,
      title: examForm.title,
      subject: teacher.subject,
      batchId: examForm.batchId,
      teacherId: teacher.id,
      duration: examForm.duration,
      questions: examForm.questions,
      scheduledAt: examForm.scheduledAt,
      status: new Date(examForm.scheduledAt) > new Date() ? 'upcoming' : 'active',
      chapterTags: examForm.chapterTags.split(',').map(t => t.trim()).filter(Boolean),
      hasNegativeMarking: examForm.hasNegativeMarking,
    };

    const batchName = batches.find(b => b.id === examData.batchId)?.name || 'Batch';

    if (editingExam) {
      setExams(prev => prev.map(e => e.id === editingExam.id ? examData : e));
      
      // Update or create announcement for edited exam
      setAnnouncements(prev => {
        const existingAnn = prev.find(a => a.referenceId === examData.id);
        if (existingAnn) {
          return prev.map(a => a.referenceId === examData.id ? {
            ...a,
            title: `Updated Exam: ${examData.title}`,
            content: `The exam "${examData.title}" for ${batchName} has been updated. Scheduled for ${format(new Date(examData.scheduledAt), 'MMM d, hh:mm a')}.`,
            targetBatch: examData.batchId,
            createdAt: new Date().toISOString(), // Update timestamp to bring to top
          } : a);
        } else {
          const newAnnouncement: Announcement = {
            id: `a-exam-${examData.id}`,
            title: `New Exam: ${examData.title}`,
            content: `A new exam "${examData.title}" has been scheduled for ${batchName}. Date: ${format(new Date(examData.scheduledAt), 'MMM d, hh:mm a')}.`,
            authorId: teacher.id,
            authorName: teacher.name,
            targetRole: 'students',
            targetBatch: examData.batchId,
            createdAt: new Date().toISOString(),
            type: 'exam',
            referenceId: examData.id,
          };
          return [newAnnouncement, ...prev];
        }
      });
    } else {
      setExams(prev => [examData, ...prev]);
      
      // Create announcement for new exam
      const newAnnouncement: Announcement = {
        id: `a-exam-${examData.id}`,
        title: `New Exam: ${examData.title}`,
        content: `A new exam "${examData.title}" has been scheduled for ${batchName}. Date: ${format(new Date(examData.scheduledAt), 'MMM d, hh:mm a')}.`,
        authorId: teacher.id,
        authorName: teacher.name,
        targetRole: 'students',
        targetBatch: examData.batchId,
        createdAt: new Date().toISOString(),
        type: 'exam',
        referenceId: examData.id,
      };
      setAnnouncements(prev => [newAnnouncement, ...prev]);
    }

    setShowCreate(false);
    setEditingExam(null);
    setExamForm(initialFormState);
    setActiveStep(0);
  };

  const getExamResults = (examId: string) => examResults.filter(r => r.examId === examId);

  const statusConfig: Record<string, { color: 'orange' | 'green' | 'gray'; label: string }> = {
    upcoming: { color: 'orange', label: '⏰ Upcoming' },
    active: { color: 'green', label: '🟢 Active' },
    completed: { color: 'gray', label: '✅ Done' },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Hub"
        subtitle={`Manage ${teacher.subject} MCQ examinations and results`}
        action={{
          label: 'Create Exam',
          icon: <Plus size={18} />,
          onClick: () => setShowCreate(true),
          color: 'blue'
        }}
      />

      {/* Exam List */}
      <div className="space-y-3">
        {myExams.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 font-medium">No exams created yet</p>
            <p className="text-slate-300 text-sm">Click "Create Exam" to get started</p>
          </div>
        ) : myExams.map(exam => {
          const results = getExamResults(exam.id);
          const batch = batches.find(b => b.id === exam.batchId);
          const cfg = statusConfig[exam.status];
          const avgScore = results.length > 0
            ? Math.round(results.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / results.length)
            : null;

          return (
            <div key={exam.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm leading-tight">{exam.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{batch?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={cfg.color}>{cfg.label}</Badge>
                  {exam.status !== 'completed' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(exam)}
                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Edit Exam"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(exam.id)}
                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete Exam"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {exam.chapterTags.map(tag => (
                  <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">Questions</p>
                  <p className="font-bold text-slate-700">{exam.questions.length}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">Duration</p>
                  <p className="font-bold text-slate-700">{exam.duration}m</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">–ve Mark</p>
                  <p className={`font-bold ${exam.hasNegativeMarking ? 'text-red-500' : 'text-green-500'}`}>
                    {exam.hasNegativeMarking ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">Attempts</p>
                  <p className="font-bold text-slate-700">{results.length}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Timer size={11} /> {format(new Date(exam.scheduledAt), 'MMM d, hh:mm a')}
                </span>
                {avgScore !== null && (
                  <span className="font-semibold text-blue-600">Avg: {avgScore}%</span>
                )}
              </div>

              {results.length > 0 && (
                <button onClick={() => setShowResults(exam)}
                  className="mt-2 w-full text-center text-xs text-blue-600 font-semibold py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1">
                  View Results <ChevronRight size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Results Modal */}
      <Modal isOpen={!!showResults} onClose={() => setShowResults(null)}
        title={`Results: ${showResults?.title}`} size="lg">
        {showResults && (() => {
          const results = getExamResults(showResults.id);
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-500">Attempts</p>
                  <p className="text-xl font-bold text-blue-700">{results.length}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-500">Avg Score</p>
                  <p className="text-xl font-bold text-green-700">
                    {results.length > 0 ? Math.round(results.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / results.length) : 0}%
                  </p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-orange-500">Top Score</p>
                  <p className="text-xl font-bold text-orange-700">
                    {results.length > 0 ? Math.round(Math.max(...results.map(r => (r.score / r.totalMarks) * 100))) : 0}%
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {results.sort((a, b) => b.score - a.score).map((r, idx) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-400' : 'bg-slate-300'}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Student #{r.studentId}</p>
                        <p className="text-xs text-slate-400">Accuracy: {r.accuracy}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{r.score}/{r.totalMarks}</p>
                      <p className="text-xs text-slate-400">{Math.round((r.score / r.totalMarks) * 100)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Create Exam Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setEditingExam(null); setExamForm(initialFormState); setActiveStep(0); }}
        title={editingExam ? 'Edit MCQ Exam' : 'Create MCQ Exam'} size="xl">
        <div className="space-y-4">
          {/* Steps */}
          <div className="flex items-center gap-2">
            {['Exam Details', 'Add Questions', 'Review'].map((step, idx) => (
              <React.Fragment key={step}>
                <button onClick={() => setActiveStep(idx)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${activeStep === idx ? 'bg-blue-600 text-white' : activeStep > idx ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {activeStep > idx ? <CheckCircle2 size={12} /> : null}
                  {step}
                </button>
                {idx < 2 && <div className="flex-1 h-px bg-slate-200" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Details */}
          {activeStep === 0 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Exam Title *</label>
                <input value={examForm.title} onChange={e => setExamForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Physics Test 04 - Current Electricity"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 text-slate-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Select Batch</label>
                  <select value={examForm.batchId} onChange={e => setExamForm(p => ({ ...p, batchId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800">
                    {myBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Duration (mins)</label>
                  <input type="number" value={examForm.duration} onChange={e => setExamForm(p => ({ ...p, duration: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Scheduled Date & Time</label>
                <input type="datetime-local" value={examForm.scheduledAt}
                  onChange={e => setExamForm(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Chapter Tags (comma separated)</label>
                <input value={examForm.chapterTags} onChange={e => setExamForm(p => ({ ...p, chapterTags: e.target.value }))}
                  placeholder="e.g. Current Electricity, Ohm's Law, Kirchhoff's Laws"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input type="checkbox" checked={examForm.hasNegativeMarking}
                  onChange={e => setExamForm(p => ({ ...p, hasNegativeMarking: e.target.checked }))}
                  className="w-4 h-4 accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Enable Negative Marking</p>
                  <p className="text-xs text-slate-400">Incorrect answers will deduct marks</p>
                </div>
              </label>
              <button onClick={() => setActiveStep(1)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold">
                Next: Add Questions →
              </button>
            </div>
          )}

          {/* Step 2: Questions */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{examForm.questions.length} Question(s)</p>
                <button onClick={addQuestion}
                  className="flex items-center gap-1 text-blue-600 text-sm font-semibold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg">
                  <Plus size={14} /> Add Question
                </button>
              </div>
              {examForm.questions.map((q, qIdx) => (
                <div key={q.id} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Q{qIdx + 1}</span>
                    {examForm.questions.length > 1 && (
                      <button onClick={() => removeQuestion(qIdx)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <textarea value={q.question} onChange={e => updateQuestion(qIdx, { question: e.target.value })}
                    placeholder="Enter question..."
                    rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-slate-800 resize-none" />
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${q.id}`} checked={q.correctOption === oIdx}
                          onChange={() => updateQuestion(qIdx, { correctOption: oIdx })}
                          className="accent-green-600 w-4 h-4 flex-shrink-0" />
                        <input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none text-slate-800 ${q.correctOption === oIdx ? 'border-green-300 bg-green-50 focus:border-green-400' : 'border-slate-200 focus:border-blue-400'}`} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Chapter</label>
                      <input value={q.chapter || ''} onChange={e => updateQuestion(qIdx, { chapter: e.target.value })}
                        placeholder="Chapter name"
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-slate-800" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">+ve Marks</label>
                      <input type="number" value={q.marks} onChange={e => updateQuestion(qIdx, { marks: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-slate-800" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">–ve Marks</label>
                      <input type="number" value={q.negativeMarks} onChange={e => updateQuestion(qIdx, { negativeMarks: Number(e.target.value) })}
                        disabled={!examForm.hasNegativeMarking}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none text-slate-800 disabled:opacity-40" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Explanation (optional)</label>
                    <input value={q.explanation || ''} onChange={e => updateQuestion(qIdx, { explanation: e.target.value })}
                      placeholder="Explain the correct answer..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800" />
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <button onClick={() => setActiveStep(0)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold">← Back</button>
                <button onClick={() => setActiveStep(2)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold">Review →</button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <h4 className="font-bold text-blue-800 mb-2">{examForm.title}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-blue-500">Batch:</span> <span className="font-medium text-slate-700">{batches.find(b => b.id === examForm.batchId)?.name}</span></div>
                  <div><span className="text-blue-500">Duration:</span> <span className="font-medium text-slate-700">{examForm.duration} mins</span></div>
                  <div><span className="text-blue-500">Questions:</span> <span className="font-medium text-slate-700">{examForm.questions.length}</span></div>
                  <div><span className="text-blue-500">Total Marks:</span> <span className="font-medium text-slate-700">{examForm.questions.reduce((s, q) => s + q.marks, 0)}</span></div>
                  <div><span className="text-blue-500">Negative:</span> <span className={`font-medium ${examForm.hasNegativeMarking ? 'text-red-600' : 'text-green-600'}`}>{examForm.hasNegativeMarking ? 'Yes' : 'No'}</span></div>
                  <div><span className="text-blue-500">Date:</span> <span className="font-medium text-slate-700">{format(new Date(examForm.scheduledAt), 'MMM d, hh:mm a')}</span></div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActiveStep(1)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold">← Edit</button>
                <button onClick={handleCreateExam}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold">
                  🚀 Publish Exam
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
