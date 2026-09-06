import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import {
  AttendanceRecord,
  AttendanceStatus,
} from '../attendance/entities/attendance-record.entity';
import { Class } from '../classes/entities/class.entity';
import { Invoice } from '../fees/entities/invoice.entity';
import { Payment, PaymentStatus } from '../fees/entities/payment.entity';
import { CreditNote } from '../fees/entities/credit-note.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { PerformanceRecord } from '../performance/entities/performance-record.entity';
import {
  ExportJob,
  ExportJobStatus,
  ReportFormat,
  ReportType,
} from './entities/export-job.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { STORAGE_ADAPTER } from '../../common/storage/storage.adapter';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// Flushes any fire-and-forget async work (`void this.processExportJob(...)`) queued as
// microtasks before the assertion that depends on it — createExportJob deliberately does not
// await that work (docs/04 §4.7's whole point), so tests that check its outcome must yield first.
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('ReportsService', () => {
  let service: ReportsService;
  const sessionRepo = { find: jest.fn().mockResolvedValue([]) };
  const recordRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const classRepo = { find: jest.fn().mockResolvedValue([]) };
  const invoiceRepo = { find: jest.fn().mockResolvedValue([]) };
  const paymentRepo = { find: jest.fn().mockResolvedValue([]) };
  const creditNoteRepo = { find: jest.fn().mockResolvedValue([]) };
  const studentRepo = { findOne: jest.fn() };
  const performanceRepo = { find: jest.fn().mockResolvedValue([]) };
  const exportJobRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) =>
      Promise.resolve({ id: 'job-1', createdAt: new Date(), ...d }),
    ),
    findOne: jest.fn(),
  };
  const teacherProfilesService = { findByUserId: jest.fn() };
  const storage = {
    writeObject: jest.fn().mockResolvedValue(undefined),
    readObject: jest.fn(),
  };

  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };
  const instituteAdmin: AuthenticatedUser = {
    userId: 'user-admin',
    activeRole: 'institute_admin',
    instituteId: 'institute-1',
  };
  const superAdmin: AuthenticatedUser = {
    userId: 'user-super',
    activeRole: 'super_admin',
    instituteId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    sessionRepo.find.mockResolvedValue([]);
    recordRepo.find.mockResolvedValue([]);
    classRepo.find.mockResolvedValue([]);
    invoiceRepo.find.mockResolvedValue([]);
    paymentRepo.find.mockResolvedValue([]);
    creditNoteRepo.find.mockResolvedValue([]);
    performanceRepo.find.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(AttendanceSession),
          useValue: sessionRepo,
        },
        { provide: getRepositoryToken(AttendanceRecord), useValue: recordRepo },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(PerformanceRecord),
          useValue: performanceRepo,
        },
        { provide: getRepositoryToken(ExportJob), useValue: exportJobRepo },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
        { provide: STORAGE_ADAPTER, useValue: storage },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  describe('generateAttendanceReport', () => {
    it('returns an empty CSV when a teacher has no classes', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      const file = await service.generateAttendanceReport(teacher, {
        from: '2026-01-01',
        to: '2026-01-31',
        format: ReportFormat.CSV,
      });
      expect(file.contentType).toBe('text/csv');
      expect(classRepo.find).not.toHaveBeenCalled();
    });

    it("aggregates a teacher's own classes only", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      classRepo.find.mockResolvedValue([
        { id: 'class-1', name: 'Guitar Batch' },
      ]);
      sessionRepo.find.mockResolvedValue([
        { id: 'session-1', class: { id: 'class-1', name: 'Guitar Batch' } },
      ]);
      recordRepo.find.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.ABSENT },
      ]);

      const file = await service.generateAttendanceReport(teacher, {
        from: '2026-01-01',
        to: '2026-01-31',
        format: ReportFormat.CSV,
      });

      expect(classRepo.find).toHaveBeenCalledWith({
        where: { teacherProfile: { id: 'teacher-profile-1' } },
      });
      const text = file.buffer.toString('utf-8');
      expect(text).toContain('Guitar Batch');
      expect(text).toContain('50.0%'); // 1 present of 2 applicable
    });

    it("scopes an institute_admin's report to their own institute", async () => {
      await service.generateAttendanceReport(instituteAdmin, {
        from: '2026-01-01',
        to: '2026-01-31',
        format: ReportFormat.CSV,
      });
      expect(classRepo.find).toHaveBeenCalledWith({
        where: { institute: { id: 'institute-1' } },
      });
    });

    it('lets super_admin drill into one institute via instituteId', async () => {
      await service.generateAttendanceReport(superAdmin, {
        from: '2026-01-01',
        to: '2026-01-31',
        format: ReportFormat.CSV,
        instituteId: 'institute-2',
      });
      expect(classRepo.find).toHaveBeenCalledWith({
        where: { institute: { id: 'institute-2' } },
      });
    });
  });

  describe('generateFeesReport', () => {
    it('computes net/paid totals per invoice, net of credit notes', async () => {
      invoiceRepo.find.mockResolvedValue([
        {
          id: 'invoice-1',
          student: { fullName: 'Jamie Lee' },
          billingPeriodStart: '2026-01-01',
          billingPeriodEnd: '2026-01-31',
          totalAmount: '1000.00',
          status: 'partial',
          dueDate: '2026-02-05',
        },
      ]);
      creditNoteRepo.find.mockResolvedValue([{ amount: '100.00' }]);
      paymentRepo.find.mockResolvedValue([
        { status: PaymentStatus.CONFIRMED, amount: '400.00' },
        { status: PaymentStatus.FAILED, amount: '999.00' },
      ]);

      const file = await service.generateFeesReport(teacher, {
        from: '2026-01-01',
        to: '2026-02-01',
        format: ReportFormat.CSV,
      });

      const text = file.buffer.toString('utf-8');
      expect(text).toContain('Jamie Lee');
      expect(text).toContain('900.00'); // 1000 - 100 credit note
      expect(text).toContain('400.00'); // only the confirmed payment counted
    });

    it('returns no rows for a teacher with no profile yet', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      const file = await service.generateFeesReport(teacher, {
        from: '2026-01-01',
        to: '2026-02-01',
        format: ReportFormat.CSV,
      });
      expect(invoiceRepo.find).not.toHaveBeenCalled();
      expect(file.buffer.toString('utf-8')).not.toContain('undefined');
    });
  });

  describe('generateStudentReport', () => {
    it('404s for a nonexistent student', async () => {
      studentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.generateStudentReport('missing', teacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a teacher with no relationship to the student', async () => {
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        fullName: 'Alex',
      });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      classRepo.find.mockResolvedValue([]);
      invoiceRepo.find.mockResolvedValue([]);
      await expect(
        service.generateStudentReport('student-1', teacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows super_admin unconditionally', async () => {
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        fullName: 'Alex',
        joinDate: '2026-01-01',
        enrollmentStatus: 'active',
      });
      const file = await service.generateStudentReport('student-1', superAdmin);
      expect(file.contentType).toBe('application/pdf');
    });
  });

  describe('export jobs', () => {
    it('creates a job in PENDING state immediately, without waiting for processing', async () => {
      const summary = await service.createExportJob(instituteAdmin, {
        reportType: ReportType.ATTENDANCE,
        format: ReportFormat.CSV,
        from: '2026-01-01',
        to: '2026-01-31',
      });
      expect(summary.status).toBe(ExportJobStatus.PENDING);
    });

    it('processes the job to COMPLETED in the background and stores the file', async () => {
      const job = {
        id: 'job-1',
        requestedBy: { id: 'user-admin' },
        reportType: ReportType.ATTENDANCE,
        format: ReportFormat.CSV,
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        instituteId: null,
        status: ExportJobStatus.PENDING,
        createdAt: new Date(),
      };
      exportJobRepo.save.mockImplementation((d) =>
        Promise.resolve({ ...job, ...d }),
      );
      exportJobRepo.findOne.mockResolvedValue(job);

      await service.createExportJob(instituteAdmin, {
        reportType: ReportType.ATTENDANCE,
        format: ReportFormat.CSV,
        from: '2026-01-01',
        to: '2026-01-31',
      });
      await flushAsync();

      expect(storage.writeObject).toHaveBeenCalled();
      expect(exportJobRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExportJobStatus.COMPLETED }),
      );
    });

    it("rejects reading another user's export job", async () => {
      exportJobRepo.findOne.mockResolvedValue({
        id: 'job-1',
        requestedBy: { id: 'someone-else' },
        status: ExportJobStatus.PENDING,
      });
      await expect(service.getExportJob('job-1', teacher)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects downloading a job that is not yet completed', async () => {
      exportJobRepo.findOne.mockResolvedValue({
        id: 'job-1',
        requestedBy: { id: teacher.userId },
        status: ExportJobStatus.PROCESSING,
      });
      await expect(service.getExportJobFile('job-1', teacher)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
