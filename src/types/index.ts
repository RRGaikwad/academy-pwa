export type UserRole = 'admin' | 'teacher' | 'student';
export type Category = '11th' | '12th' | 'GAP/DROPPER';
export type Stream = 'PCM' | 'PCB';
export type SubjectName = 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
}

export interface Student extends User {
  role: 'student';
  studentId: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  category: Category;
  stream: Stream;
  subjects: SubjectName[];
  admissionDate: string;
  totalFees: number;
  paidFees: number;
  attendancePercent: number;
  performanceScore: number;
  notes: string;
  batchId: string;
}

export interface Teacher extends User {
  role: 'teacher';
  teacherId: string;
  subject: SubjectName;
  assignedCategories: string[];
  phone: string;
  permissions: string[];
}

export interface Batch {
  id: string;
  name: string;
  category: Category;
  stream: Stream;
  teacherIds: string[];
  studentIds: string[];
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  batchId: string;
  date: string;
  subject: SubjectName;
  teacherId: string;
  records: { studentId: string; present: boolean }[];
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation?: string;
  marks: number;
  negativeMarks: number;
  chapter?: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: SubjectName;
  batchId: string;
  teacherId: string;
  duration: number; // minutes
  questions: MCQQuestion[];
  scheduledAt: string;
  status: 'upcoming' | 'active' | 'completed';
  chapterTags: string[];
  hasNegativeMarking: boolean;
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  answers: number[];
  score: number;
  totalMarks: number;
  accuracy: number;
  rank?: number;
  submittedAt: string;
  weakChapters: string[];
}

export interface FeePayment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  mode: string;
  receiptNo: string;
  note?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  targetRole: 'all' | 'students' | 'teachers';
  targetBatch?: string;
  createdAt: string;
  type: 'exam' | 'holiday' | 'fees' | 'general' | 'result' | 'material';
  referenceId?: string;
}

export interface StudyMaterial {
  id: string;
  title: string;
  subject: SubjectName;
  batchId: string;
  teacherId: string;
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
  chapter?: string;
}
