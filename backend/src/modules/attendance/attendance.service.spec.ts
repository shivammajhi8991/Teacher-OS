import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AttendanceService } from './attendance.service';
import { AttendanceSession } from './entities/attendance-session.entity';
import {
  AttendanceRecord,
  AttendanceStatus,
} from './entities/attendance-record.entity';
import { AttendanceAuditLog } from './entities/attendance-audit-log.entity';
import { Class } from '../classes/entities/class.entity';
import { Institute } from '../institutes/entities/institute.entity';
import {
  ScheduleException,
  ScheduleExceptionType,
} from '../classes/entities/schedule-exception.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/05 §5.7-equivalent for the backend: these cover docs/01 §1.5's named edge cases directly —
// "class is cancelled," "duplicate attendance submission" (idempotent re-mark), "attendance
// edited after fee calculation" (invoiced guard), and the teacher-only-by-default access rule.
describe('AttendanceService', () => {
  let service: AttendanceService;
  const sessionRepo = { findOne: jest.fn() };
  const recordRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
  const auditLogRepo = { create: jest.fn(), save: jest.fn() };
  const classRepo = { findOne: jest.fn() };
  const instituteRepo = { findOne: jest.fn() };
  const exceptionRepo = { findOne: jest.fn() };
  const enrollmentRepo = { find: jest.fn() };
  const studentRepo = { findOne: jest.fn() };
  const guardianLinkRepo = { findOne: jest.fn() };
  const assignmentRepo = { findOne: jest.fn() };
  const teacherProfilesService = { findByUserId: jest.fn() };
  const dataSource = { transaction: jest.fn() };

  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };
  const cls = {
    id: 'class-1',
    institute: null,
    teacherProfile: { id: 'teacher-profile-1' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: getRepositoryToken(AttendanceSession),
          useValue: sessionRepo,
        },
        { provide: getRepositoryToken(AttendanceRecord), useValue: recordRepo },
        {
          provide: getRepositoryToken(AttendanceAuditLog),
          useValue: auditLogRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        { provide: getRepositoryToken(Institute), useValue: instituteRepo },
        {
          provide: getRepositoryToken(ScheduleException),
          useValue: exceptionRepo,
        },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        {
          provide: getRepositoryToken(StudentTeacherAssignment),
          useValue: assignmentRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get(AttendanceService);
    classRepo.findOne.mockResolvedValue(cls);
    teacherProfilesService.findByUserId.mockResolvedValue({
      id: 'teacher-profile-1',
    });
    enrollmentRepo.find.mockResolvedValue([]);
    exceptionRepo.findOne.mockResolvedValue(null);
  });

  describe('access control', () => {
    it("rejects a teacher who doesn't teach this class", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'someone-elses-profile',
      });

      await expect(
        service.getRoster('class-1', '2026-01-05', teacher),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an institute_admin whose institute has not opted into attendance override', async () => {
      const admin: AuthenticatedUser = {
        userId: 'admin-1',
        activeRole: 'institute_admin',
        instituteId: 'institute-1',
      };
      classRepo.findOne.mockResolvedValue({
        ...cls,
        institute: { id: 'institute-1' },
      });
      instituteRepo.findOne.mockResolvedValue({
        id: 'institute-1',
        allowAdminAttendanceOverride: false,
      });

      await expect(
        service.getRoster('class-1', '2026-01-05', admin),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('bulkMark', () => {
    it('rejects marking a cancelled/holiday occurrence', async () => {
      exceptionRepo.findOne.mockResolvedValue({
        exceptionType: ScheduleExceptionType.HOLIDAY,
        reason: 'Diwali',
      });

      await expect(
        service.bulkMark('class-1', '2026-01-05', teacher, {
          records: [
            { studentId: 'student-1', status: AttendanceStatus.PRESENT },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('skips a submitted student who is not actively enrolled, without failing the whole batch', async () => {
      enrollmentRepo.find.mockResolvedValue([]); // nobody actively enrolled
      dataSource.transaction.mockImplementation(async (cb) =>
        cb({
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn((_, data) => data),
          save: jest.fn((data) => Promise.resolve({ id: 'new', ...data })),
        }),
      );
      recordRepo.find.mockResolvedValue([]);
      sessionRepo.findOne.mockResolvedValue(null);

      const result = await service.bulkMark('class-1', '2026-01-05', teacher, {
        records: [
          {
            studentId: 'not-enrolled-student',
            status: AttendanceStatus.PRESENT,
          },
        ],
      });

      expect(result.skippedStudentIds).toEqual(['not-enrolled-student']);
    });
  });

  describe('updateRecord', () => {
    const baseRecord = {
      id: 'record-1',
      status: AttendanceStatus.PRESENT,
      invoiced: false,
      student: { id: 'student-1' },
      attendanceSession: { class: cls },
    };

    it('rejects editing a record that has already been invoiced', async () => {
      recordRepo.findOne.mockResolvedValue({ ...baseRecord, invoiced: true });

      await expect(
        service.updateRecord('record-1', teacher, {
          status: AttendanceStatus.ABSENT,
          reason: 'oops',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(recordRepo.save).not.toHaveBeenCalled();
    });

    it('writes an audit log entry when the status actually changes', async () => {
      recordRepo.findOne.mockResolvedValue({ ...baseRecord });
      recordRepo.save.mockImplementation((r) => Promise.resolve(r));
      auditLogRepo.create.mockImplementation((data) => data);

      await service.updateRecord('record-1', teacher, {
        status: AttendanceStatus.ABSENT,
        reason: 'Parent called in sick',
      });

      expect(auditLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          previousStatus: AttendanceStatus.PRESENT,
          newStatus: AttendanceStatus.ABSENT,
        }),
      );
    });

    it('does not write an audit log entry when the status is unchanged (idempotent edit)', async () => {
      recordRepo.findOne.mockResolvedValue({ ...baseRecord });
      recordRepo.save.mockImplementation((r) => Promise.resolve(r));

      await service.updateRecord('record-1', teacher, {
        status: AttendanceStatus.PRESENT,
        reason: 'no actual change',
      });

      expect(auditLogRepo.save).not.toHaveBeenCalled();
    });
  });
});
