import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ClassesService } from './classes.service';
import { Class } from './entities/class.entity';
import { ClassScheduleVersion } from './entities/class-schedule-version.entity';
import { ScheduleException } from './entities/schedule-exception.entity';
import {
  Enrollment,
  EnrollmentEntryStatus,
} from './entities/enrollment.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/05 §5.7-equivalent for the backend: the highest-value cases here are the ones docs/01
// §1.3/§1.5 call out by name — capacity → waitlist suggestion, duplicate enrollment, and a
// malformed recurrence rule rejected before anything is persisted.
describe('ClassesService', () => {
  let service: ClassesService;
  const classRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const scheduleVersionRepo = { findOne: jest.fn() };
  const exceptionRepo = { create: jest.fn(), save: jest.fn() };
  const enrollmentRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const waitlistRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const studentRepo = { findOne: jest.fn() };
  const teacherProfilesService = { findByUserId: jest.fn() };
  const dataSource = { transaction: jest.fn() };

  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: getRepositoryToken(Class), useValue: classRepo },
        {
          provide: getRepositoryToken(ClassScheduleVersion),
          useValue: scheduleVersionRepo,
        },
        {
          provide: getRepositoryToken(ScheduleException),
          useValue: exceptionRepo,
        },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(WaitlistEntry), useValue: waitlistRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get(ClassesService);
  });

  describe('create', () => {
    it('rejects a caller with no teacher profile', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          name: 'Guitar Batch',
          mode: 'offline' as any,
          startDate: '2026-01-05',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(classRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('enrollStudent', () => {
    const cls = {
      id: 'class-1',
      institute: null,
      teacherProfile: { id: 'teacher-profile-1' },
      capacityMax: 2,
    };

    beforeEach(() => {
      classRepo.findOne.mockResolvedValue(cls);
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    });

    it('rejects a student already actively enrolled', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ id: 'existing-enrollment' });

      await expect(
        service.enrollStudent('class-1', teacher, { studentId: 'student-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(enrollmentRepo.save).not.toHaveBeenCalled();
    });

    it('suggests the waitlist when the class is at capacity', async () => {
      enrollmentRepo.findOne.mockResolvedValue(null); // not already enrolled
      enrollmentRepo.count.mockResolvedValue(2); // == capacityMax

      await expect(
        service.enrollStudent('class-1', teacher, { studentId: 'student-1' }),
      ).rejects.toMatchObject({ response: { code: 'CLASS_AT_CAPACITY' } });
      expect(enrollmentRepo.save).not.toHaveBeenCalled();
    });

    it('enrolls when there is room and the student is not already enrolled', async () => {
      enrollmentRepo.findOne.mockResolvedValue(null);
      enrollmentRepo.count.mockResolvedValue(1); // below capacityMax
      enrollmentRepo.create.mockImplementation((data) => data);
      enrollmentRepo.save.mockImplementation((data) =>
        Promise.resolve({ id: 'new-enrollment', ...data }),
      );

      const result = await service.enrollStudent('class-1', teacher, {
        studentId: 'student-1',
      });

      expect(result.status).toBe(EnrollmentEntryStatus.ACTIVE);
    });
  });

  describe('addToWaitlist', () => {
    it('rejects a duplicate waitlist entry', async () => {
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        institute: null,
        teacherProfile: { id: 'teacher-profile-1' },
      });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
      waitlistRepo.findOne.mockResolvedValue({ id: 'existing-waitlist-entry' });

      await expect(
        service.addToWaitlist('class-1', teacher, { studentId: 'student-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(waitlistRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('createSchedule', () => {
    it('rejects a malformed recurrence rule before touching the database', async () => {
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        institute: null,
        teacherProfile: { id: 'teacher-profile-1' },
      });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });

      await expect(
        service.createSchedule('class-1', teacher, {
          effectiveFrom: '2026-01-05',
          recurrenceRule: 'NOT A VALID RRULE',
          startTime: '16:00',
          endTime: '17:00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('access control', () => {
    it("rejects updating a class the caller doesn't teach", async () => {
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        institute: null,
        teacherProfile: { id: 'someone-elses-profile' },
      });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });

      await expect(
        service.update('class-1', teacher, { name: 'Hacked' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(classRepo.save).not.toHaveBeenCalled();
    });
  });
});
