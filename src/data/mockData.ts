import { Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial } from '../types';

export const mockStudents: Student[] = [];

export const mockTeachers: Teacher[] = [];

export const adminUser = {
  id: 'admin1', name: 'Anand Sharma', email: 'admin@academy.com', password: 'admin123',
  role: 'admin' as const, phone: '9800000001'
};

export const mockBatches: Batch[] = [
  { id: 'b1', name: '12th PCM', category: '12th', stream: 'PCM', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: 'b2', name: '12th PCB', category: '12th', stream: 'PCB', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: 'b3', name: '11th PCM', category: '11th', stream: 'PCM', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: 'b4', name: '11th PCB', category: '11th', stream: 'PCB', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: 'b5', name: 'GAP/DROPPER PCM', category: 'GAP/DROPPER', stream: 'PCM', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: 'b6', name: 'GAP/DROPPER PCB', category: 'GAP/DROPPER', stream: 'PCB', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
];

export const mockAttendance: AttendanceRecord[] = [];

export const mockExams: Exam[] = [];

export const mockExamResults: ExamResult[] = [];

export const mockFeePayments: FeePayment[] = [];

export const mockAnnouncements: Announcement[] = [];

export const mockStudyMaterials: StudyMaterial[] = [];

export const performanceTrend: any[] = [];

export const batchPerformance: any[] = [];
