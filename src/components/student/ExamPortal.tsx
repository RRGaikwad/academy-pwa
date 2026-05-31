import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Exam, ExamResult } from '../../types';
import { Badge } from '../shared/Badge';
import { Timer, CheckCircle2, XCircle, AlertTriangle, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export const ExamPortal: React.FC = () => {
  const { currentUser, exams, examResults, setExamResults } = useApp();
  const student = currentUser;

  const myExams = exams.filter(e => e.batchId === student.batchId);
  const myResults = examResults.filter(r => r.studentId === student.id);

  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  // Timer
  useEffect(() => {
    if (!activeExam || examSubmitted) return;
    if (timeLeft <= 0) {
      if (activeExam) handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [activeExam, timeLeft, examSubmitted]);

  const startExam = (exam: Exam) => {
    setActiveExam(exam);
    setCurrentQ(0);
    setAnswers({});
    setTimeLeft(exam.duration * 60);
    setExamSubmitted(false);
    setResult(null);
  };

  const handleAnswer = (optIdx: number) => {
    setAnswers(prev => ({ ...prev, [currentQ]: optIdx }));
  };

  const handleSubmit = useCallback(() => {
    if (!activeExam) return;

    let score = 0;
    let totalMarks = 0;
    let correct = 0;
    const weakChapters: string[] = [];

    activeExam.questions.forEach((q, idx) => {
      totalMarks += q.marks;
      if (answers[idx] === undefined) return;
      if (answers[idx] === q.correctOption) {
        score += q.marks;
        correct++;
      } else if (activeExam.hasNegativeMarking) {
        score -= q.negativeMarks;
        if (q.chapter && !weakChapters.includes(q.chapter)) weakChapters.push(q.chapter);
      }
    });

    score = Math.max(0, score);
    const accuracy = Math.round((correct / activeExam.questions.length) * 100);

    // Calculate rank
    const existingResults = examResults.filter(r => r.examId === activeExam.id);
    const rank = existingResults.filter(r => r.score > score).length + 1;

    const newResult: ExamResult = {
      id: `r${Date.now()}`,
      examId: activeExam.id,
      studentId: student.id,
      answers: activeExam.questions.map((_, idx) => answers[idx] ?? -1),
      score,
      totalMarks,
      accuracy,
      rank,
      submittedAt: new Date().toISOString(),
      weakChapters,
    };

    setExamResults(prev => [...prev, newResult]);
    setResult(newResult);
    setExamSubmitted(true);
  }, [activeExam, answers, examResults, student.id]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const hasAttempted = (examId: string) => myResults.some(r => r.examId === examId);
  const getResult = (examId: string) => myResults.find(r => r.examId === examId);

  // Exam in progress view
  if (activeExam && !examSubmitted) {
    const q = activeExam.questions[currentQ];
    const answeredCount = Object.keys(answers).length;
    const isLowTime = timeLeft < 300;

    return (
      <div className="space-y-4">
        {/* Exam Header */}
        <div className={`rounded-2xl p-4 text-white ${isLowTime ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-blue-600 to-indigo-700'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold opacity-90">{activeExam.title}</p>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-bold text-sm ${isLowTime ? 'bg-white/20' : 'bg-white/15'}`}>
              <Timer size={14} />
              {formatTime(timeLeft)}
            </div>
          </div>
          <p className="text-xs opacity-70">{activeExam.questions.length} Qs • {answeredCount} answered</p>
          {/* Progress */}
          <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${(answeredCount / activeExam.questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Question Navigation */}
        <div className="flex flex-wrap gap-1.5">
          {activeExam.questions.map((_, idx) => (
            <button key={idx} onClick={() => setCurrentQ(idx)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${idx === currentQ ? 'bg-blue-600 text-white shadow-md' : answers[idx] !== undefined ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">Q{currentQ + 1}</span>
            {q.chapter && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{q.chapter}</span>}
          </div>
          <p className="text-slate-800 font-medium leading-relaxed mb-4">{q.question}</p>

          <div className="space-y-2">
            {q.options.map((option, oIdx) => (
              <button key={oIdx} onClick={() => handleAnswer(oIdx)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm ${answers[currentQ] === oIdx
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                  }`}>
                <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold mr-2 ${answers[currentQ] === oIdx ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {String.fromCharCode(65 + oIdx)}
                </span>
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <span>+{q.marks} marks</span>
            {activeExam.hasNegativeMarking && <span className="text-red-400">-{q.negativeMarks} if wrong</span>}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}
            className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1">
            <ChevronLeft size={16} /> Prev
          </button>
          {currentQ < activeExam.questions.length - 1 ? (
            <button onClick={() => setCurrentQ(q => q + 1)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1">
              <CheckCircle2 size={16} /> Submit Exam
            </button>
          )}
        </div>

        {/* Submit early */}
        {answeredCount > 0 && currentQ < activeExam.questions.length - 1 && (
          <button onClick={() => { if (confirm('Submit exam early?')) handleSubmit(); }}
            className="w-full text-red-500 text-sm font-medium py-2 border border-red-100 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            ⚠️ Submit Early ({activeExam.questions.length - answeredCount} unanswered)
          </button>
        )}
      </div>
    );
  }

  // Result View
  if (examSubmitted && result) {
    const pct = Math.round((result.score / result.totalMarks) * 100);
    const grade = pct >= 90 ? { label: 'Excellent!', color: 'text-green-600', bg: 'bg-green-50', emoji: '🏆' } :
      pct >= 75 ? { label: 'Good Job!', color: 'text-blue-600', bg: 'bg-blue-50', emoji: '🌟' } :
        pct >= 50 ? { label: 'Average', color: 'text-amber-600', bg: 'bg-amber-50', emoji: '📈' } :
          { label: 'Needs Improvement', color: 'text-red-600', bg: 'bg-red-50', emoji: '📚' };

    return (
      <div className="space-y-4">
        <div className={`${grade.bg} rounded-2xl p-6 text-center border border-slate-100`}>
          <div className="text-5xl mb-2">{grade.emoji}</div>
          <p className={`text-2xl font-bold ${grade.color}`}>{grade.label}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-4xl font-bold text-slate-800">{result.score}</span>
            <span className="text-xl text-slate-400">/ {result.totalMarks}</span>
          </div>
          <p className="text-slate-500 mt-1">{pct}% Score</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-xs text-slate-400">Accuracy</p>
            <p className="text-xl font-bold text-blue-600">{result.accuracy}%</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-xs text-slate-400">Rank</p>
            <p className="text-xl font-bold text-yellow-600">#{result.rank || 1}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-xs text-slate-400">Questions</p>
            <p className="text-xl font-bold text-slate-700">{activeExam?.questions.length}</p>
          </div>
        </div>

        {/* Answer Review */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">Answer Review</h3>
          <div className="space-y-3">
            {activeExam?.questions.map((q, idx) => {
              const given = result.answers[idx];
              const isCorrect = given === q.correctOption;
              const isSkipped = given === -1;
              return (
                <div key={idx} className={`p-3 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-200' : isSkipped ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {isCorrect ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" /> :
                      isSkipped ? <div className="w-4 h-4 rounded-full border-2 border-slate-400 mt-0.5 flex-shrink-0" /> :
                        <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-tight">{q.question}</p>
                      {!isSkipped && (
                        <p className={`text-xs mt-1 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                          Your answer: {q.options[given]}
                        </p>
                      )}
                      {!isCorrect && (
                        <p className="text-xs text-green-600 mt-0.5">Correct: {q.options[q.correctOption]}</p>
                      )}
                      {q.explanation && (
                        <p className="text-xs text-slate-500 mt-1 italic">💡 {q.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {result.weakChapters.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} /> Weak Chapters
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.weakChapters.map(ch => <Badge key={ch} color="orange">{ch}</Badge>)}
            </div>
          </div>
        )}

        <button onClick={() => { setActiveExam(null); setExamSubmitted(false); setResult(null); }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-sm font-bold">
          ← Back to Exam Portal
        </button>
      </div>
    );
  }

  // Exam List View
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Exam Portal</h2>
        <p className="text-slate-500 text-sm">{myExams.length} exams in your batch</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'upcoming', label: '⏰ Upcoming', count: myExams.filter(e => e.status === 'upcoming').length },
          { key: 'completed', label: '✅ Completed', count: myExams.filter(e => e.status === 'completed').length },
        ].map(({ key, label, count }) => (
          <div key={key} className="flex-1 bg-white rounded-xl p-3 text-center shadow-sm border border-slate-100">
            <p className="text-slate-500 text-xs">{label}</p>
            <p className="font-bold text-slate-800 text-lg">{count}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {myExams.length === 0 && (
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 font-medium">No exams scheduled</p>
          </div>
        )}

        {myExams.map(exam => {
          const attempted = hasAttempted(exam.id);
          const myResult = attempted ? getResult(exam.id) : null;
          const pct = myResult ? Math.round((myResult.score / myResult.totalMarks) * 100) : null;

          return (
            <div key={exam.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">{exam.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{exam.subject}</p>
                </div>
                <Badge color={exam.status === 'upcoming' ? 'orange' : exam.status === 'active' ? 'green' : 'gray'}>
                  {exam.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {exam.chapterTags.map(t => (
                  <span key={t} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-xs mb-3">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">Qs</p>
                  <p className="font-bold text-slate-700">{exam.questions.length}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">Mins</p>
                  <p className="font-bold text-slate-700">{exam.duration}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">Marks</p>
                  <p className="font-bold text-slate-700">{exam.questions.reduce((s, q) => s + q.marks, 0)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">–ve</p>
                  <p className={`font-bold ${exam.hasNegativeMarking ? 'text-red-500' : 'text-green-500'}`}>
                    {exam.hasNegativeMarking ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  📅 {format(new Date(exam.scheduledAt), 'MMM d, hh:mm a')}
                </p>
                {attempted && myResult ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold px-3 py-1 rounded-lg ${pct! >= 75 ? 'bg-green-100 text-green-700' : pct! >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {pct}%
                    </span>
                    <span className="text-xs text-slate-400">#{myResult.rank}</span>
                  </div>
                ) : exam.status !== 'completed' ? (
                  <button onClick={() => startExam(exam)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm shadow-blue-200">
                    Start Exam →
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Not attempted</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
