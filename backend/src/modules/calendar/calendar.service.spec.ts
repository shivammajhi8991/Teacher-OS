import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalendarService } from './calendar.service';
import { Class } from '../classes/entities/class.entity';
import { ClassScheduleVersion } from '../classes/entities/class-schedule-version.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Invoice } from '../fees/entities/invoice.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/03 §3.5 conflict-detection, docs/06 §6.2 Calendar row — this suite exercises the two
// things unique to this module: per-role default scope resolution, and pairwise conflict
// flagging over whatever's already been fetched (no fresh per-class query, unlike
// ClassesService.getConflicts).
describe('CalendarService', () => {
  let service: CalendarService;
  const classRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const scheduleVersionRepo = { findOne: jest.fn() };
  const enrollmentRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const assignmentRepo = { find: jest.fn().mockResolvedValue([]) };
  const invoiceRepo = { find: jest.fn().mockResolvedValue([]) };
  const studentRepo = { findOne: jest.fn() };
  const guardianLinkRepo = { find: jest.fn().mockResolvedValue([]) };
  const teacherProfilesService = { findByUserId: jest.fn() };

  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };
  const student: AuthenticatedUser = {
    userId: 'user-student',
    activeRole: 'student',
    instituteId: null,
  };
  const parent: AuthenticatedUser = {
    userId: 'user-parent',
    activeRole: 'parent',
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

  // A weekly Monday-Wednesday-Friday 09:00-10:00 class, effective well before the query window.
  const weeklyVersion = {
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    startTime: '09:00:00',
    endTime: '10:00:00',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    classRepo.find.mockResolvedValue([]);
    enrollmentRepo.find.mockResolvedValue([]);
    assignmentRepo.find.mockResolvedValue([]);
    invoiceRepo.find.mockResolvedValue([]);
    guardianLinkRepo.find.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: getRepositoryToken(Class), useValue: classRepo },
        {
          provide: getRepositoryToken(ClassScheduleVersion),
          useValue: scheduleVersionRepo,
        },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(Assignment), useValue: assignmentRepo },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
      ],
    }).compile();
    service = module.get(CalendarService);
  });

  describe('scope resolution — implicit "own"', () => {
    it("resolves a teacher's own classes, not the whole platform", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      await service.getCalendar(teacher, {
        from: '2026-02-01',
        to: '2026-02-28',
      });
      expect(classRepo.find).toHaveBeenCalledWith({
        where: {
          teacherProfile: { id: 'teacher-profile-1' },
          status: 'active',
        },
      });
    });

    it('returns no events for a teacher with no profile yet, without touching classRepo', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      const events = await service.getCalendar(teacher, {
        from: '2026-02-01',
        to: '2026-02-28',
      });
      expect(events).toEqual([]);
      expect(classRepo.find).not.toHaveBeenCalled();
    });

    it("resolves a student's own enrollments", async () => {
      studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
      await service.getCalendar(student, {
        from: '2026-02-01',
        to: '2026-02-28',
      });
      expect(enrollmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ student: { id: 'student-1' } }),
        }),
      );
    });

    it('aggregates every linked child for a parent', async () => {
      guardianLinkRepo.find.mockResolvedValue([
        { student: { id: 'child-1' } },
        { student: { id: 'child-2' } },
      ]);
      await service.getCalendar(parent, {
        from: '2026-02-01',
        to: '2026-02-28',
      });
      expect(enrollmentRepo.find).toHaveBeenCalledTimes(2);
    });

    it('scopes an institute_admin to their own institute', async () => {
      await service.getCalendar(instituteAdmin, {
        from: '2026-02-01',
        to: '2026-02-28',
      });
      expect(classRepo.find).toHaveBeenCalledWith({
        where: { status: 'active', institute: { id: 'institute-1' } },
      });
    });

    it('gives super_admin a platform-wide (unfiltered) view by default', async () => {
      await service.getCalendar(superAdmin, {
        from: '2026-02-01',
        to: '2026-02-28',
      });
      expect(classRepo.find).toHaveBeenCalledWith({
        where: { status: 'active' },
      });
    });
  });

  describe('explicit ownerType', () => {
    it('requires ownerId when ownerType is given', async () => {
      await expect(
        service.getCalendar(teacher, {
          from: '2026-02-01',
          to: '2026-02-28',
          ownerType: 'class',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a teacher requesting a class they don't teach", async () => {
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        teacherProfile: { id: 'teacher-profile-other' },
        institute: null,
      });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      await expect(
        service.getCalendar(teacher, {
          from: '2026-02-01',
          to: '2026-02-28',
          ownerType: 'class',
          ownerId: 'class-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects an institute_admin requesting another institute's calendar", async () => {
      await expect(
        service.getCalendar(instituteAdmin, {
          from: '2026-02-01',
          to: '2026-02-28',
          ownerType: 'institute',
          ownerId: 'institute-2',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('conflict flagging', () => {
    it('flags two overlapping classes taught by the same teacher', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      classRepo.find.mockResolvedValue([
        { id: 'class-1', name: 'Class A' },
        { id: 'class-2', name: 'Class B' },
      ]);
      scheduleVersionRepo.findOne.mockResolvedValue(weeklyVersion);
      classRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            name: where.id === 'class-1' ? 'Class A' : 'Class B',
            teacherProfile: { id: 'teacher-profile-1' },
            institute: null,
            locationOrMeetingLink: null,
          }),
      );

      const events = await service.getCalendar(teacher, {
        from: '2026-02-01',
        to: '2026-02-28',
      });

      const occurrenceEvents = events.filter(
        (e) => e.eventType === 'class_occurrence',
      );
      expect(occurrenceEvents.length).toBeGreaterThan(0);
      expect(occurrenceEvents.every((e) => e.conflict)).toBe(true);
      expect(
        occurrenceEvents.every(
          (e) => e.conflictReason === 'teacher_double_booking',
        ),
      ).toBe(true);
    });

    it('does not flag two classes with different teachers and no shared location', async () => {
      classRepo.find.mockResolvedValue([
        { id: 'class-1', name: 'Class A' },
        { id: 'class-2', name: 'Class B' },
      ]);
      scheduleVersionRepo.findOne.mockResolvedValue(weeklyVersion);
      classRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            name: where.id === 'class-1' ? 'Class A' : 'Class B',
            teacherProfile: {
              id: where.id === 'class-1' ? 'teacher-1' : 'teacher-2',
            },
            institute: { id: 'institute-1' },
            locationOrMeetingLink: null,
          }),
      );

      const events = await service.getCalendar(instituteAdmin, {
        from: '2026-02-01',
        to: '2026-02-28',
      });

      expect(events.every((e) => !e.conflict)).toBe(true);
    });

    it('flags a location conflict between different teachers sharing a room', async () => {
      classRepo.find.mockResolvedValue([
        { id: 'class-1', name: 'Class A' },
        { id: 'class-2', name: 'Class B' },
      ]);
      scheduleVersionRepo.findOne.mockResolvedValue(weeklyVersion);
      classRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            name: where.id === 'class-1' ? 'Class A' : 'Class B',
            teacherProfile: {
              id: where.id === 'class-1' ? 'teacher-1' : 'teacher-2',
            },
            institute: { id: 'institute-1' },
            locationOrMeetingLink: 'Room 101',
          }),
      );

      const events = await service.getCalendar(instituteAdmin, {
        from: '2026-02-01',
        to: '2026-02-28',
      });

      const occurrenceEvents = events.filter(
        (e) => e.eventType === 'class_occurrence',
      );
      expect(
        occurrenceEvents.every(
          (e) => e.conflict && e.conflictReason === 'location_conflict',
        ),
      ).toBe(true);
    });
  });

  describe('assignment and fee due events', () => {
    it("includes a student's fee due dates within range", async () => {
      studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
      invoiceRepo.find.mockResolvedValue([
        {
          id: 'invoice-1',
          dueDate: '2026-02-15',
          currency: 'INR',
          totalAmount: '1000.00',
        },
        {
          id: 'invoice-2',
          dueDate: '2026-05-01',
          currency: 'INR',
          totalAmount: '500.00',
        }, // out of range
      ]);

      const events = await service.getCalendar(student, {
        from: '2026-02-01',
        to: '2026-02-28',
      });

      const feeEvents = events.filter((e) => e.eventType === 'fee_due');
      expect(feeEvents).toHaveLength(1);
      expect(feeEvents[0].sourceId).toBe('invoice-1');
    });
  });
});
