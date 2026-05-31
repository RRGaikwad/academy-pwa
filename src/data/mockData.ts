import { Student, Teacher, Batch, AttendanceRecord, Exam, ExamResult, FeePayment, Announcement, StudyMaterial } from '../types';

export const mockStudents: Student[] = [];

export const mockTeachers: Teacher[] = [];

export const adminUser = {
  id: 'admin1', name: 'Anand Sharma', email: 'admin@academy.com', password: 'admin123',
  role: 'admin' as const, phone: '9800000001'
};

export const mockBatches: Batch[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: '12th PCM', category: '12th', stream: 'PCM', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: '22222222-2222-2222-2222-222222222222', name: '12th PCB', category: '12th', stream: 'PCB', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: '33333333-3333-3333-3333-333333333333', name: '11th PCM', category: '11th', stream: 'PCM', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444444', name: '11th PCB', category: '11th', stream: 'PCB', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: '55555555-5555-5555-5555-555555555555', name: 'GAP/DROPPER PCM', category: 'GAP/DROPPER', stream: 'PCM', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
  { id: '66666666-6666-6666-6666-666666666666', name: 'GAP/DROPPER PCB', category: 'GAP/DROPPER', stream: 'PCB', teacherIds: [], studentIds: [], createdAt: new Date().toISOString() },
];

export const mockAttendance: AttendanceRecord[] = [];

export const mockExams: Exam[] = [];

export const mockExamResults: ExamResult[] = [];

export const mockFeePayments: FeePayment[] = [];

export const mockAnnouncements: Announcement[] = [];

export const mockStudyMaterials: StudyMaterial[] = [];

export const performanceTrend: any[] = [];

export const batchPerformance: any[] = [];
