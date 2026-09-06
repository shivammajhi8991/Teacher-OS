import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssignmentsService } from './assignments.service';
import { Assignment } from './entities/assignment.entity';
import {
  AssignmentSubmission,
  SubmissionStatus,
} from './entities/assignment-submission.entity';
import { Class } from '../classes/entities/class.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { STORAGE_ADAPTER } from '../../common/storage/storage.adapter';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/06 §6.2's Assignments rows are the interesting logic here: only the owning teacher can
// create/review, a student can only act on assignments actually targeting them (direct or via
// active class enrollment), and the late/resubmission edge cases docs/08 §8.5 names explicitly.
describe('AssignmentsService', () => {
  let service: AssignmentsService;
  const assignmentRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'assignment-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const submissionRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'submission-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  const classRepo = { findOne: jest.fn() };
  const enrollmentRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
  };
  const studentRepo = { findOne: jest.fn() };
  const guardianLinkRepo = { find: jest.fn().mockResolvedValue([]) };
  const teacherProfilesService = { findByUserId: jest.fn() };
  const notificationsService = {
    notify: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    createPresignedUpload: jest.fn(),
    objectExists: jest.fn().mockResolvedValue(false),
    readObject: jest.fn(),
    writeObject: jest.fn(),
    deleteObject: jest.fn(),
  };

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
  const cls = { id: 'class-1', teacherProfile: { id: 'teacher-profile-1' } };
  const studentProfile = { id: 'student-1' };

  const rawAssignment = {
    id: 'assignment-1',
    title: 'Essay',
    description: null,
    class: cls,
    student: null,
    teacherProfile: { id: 'teacher-profile-1', institute: null },
    attachmentUrls: [],
    dueAt: new Date('2099-01-01'), // far future — never "late" unless a test says otherwise
    allowLateSubmission: true,
    allowResubmission: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: getRepositoryToken(Assignment), useValue: assignmentRepo },
        {
          provide: getRepositoryToken(AssignmentSubmission),
          useValue: submissionRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: STORAGE_ADAPTER, useValue: storage },
      ],
    }).compile();

    service = module.get(AssignmentsService);

    // Safe, explicit defaults — jest.clearAllMocks() drops call history but not a mock's
    // last-set resolved value, so every test below only overrides what it actually needs.
    classRepo.findOne.mockResolvedValue(cls);
    teacherProfilesService.findByUserId.mockResolvedValue({
      id: 'teacher-profile-1',
    });
    studentRepo.findOne.mockResolvedValue(studentProfile);
    assignmentRepo.findOne.mockResolvedValue(rawAssignment);
    enrollmentRepo.findOne.mockResolvedValue({ id: 'enrollment-1' });
    enrollmentRepo.find.mockResolvedValue([]);
    submissionRepo.count.mockResolvedValue(0);
    guardianLinkRepo.find.mockResolvedValue([]);
    storage.objectExists.mockResolvedValue(false);
  });

  describe('createAssignment', () => {
    it('rejects when neither classId nor studentId is given', async () => {
      await expect(
        service.createAssignment(teacher, {
          title: 't',
          dueAt: '2099-01-01',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when both classId and studentId are given', async () => {
      await expect(
        service.createAssignment(teacher, {
          title: 't',
          dueAt: '2099-01-01',
          classId: 'class-1',
          studentId: 'student-1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a teacher who does not teach the target class', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'someone-elses-profile',
      });
      await expect(
        service.createAssignment(teacher, {
          title: 't',
          dueAt: '2099-01-01',
          classId: 'class-1',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    // A mocked classRepo doesn't care what `relations` a real TypeORM call asked for — it always
    // returns whatever the test told it to. So this ownership check can pass every unit test
    // here while still crashing for real (Class.teacherProfile isn't `eager`, so a findOne()
    // without `relations: { teacherProfile: true }` leaves it undefined) — exactly what happened
    // until a live-Postgres smoke test caught it. Asserting the actual find() options is the
    // unit-test-level guard against that regressing silently again.
    it('loads the class with its teacherProfile relation (not eager — required for the ownership check above)', async () => {
      await service.createAssignment(teacher, {
        title: 't',
        dueAt: '2099-01-01',
        classId: 'class-1',
      } as any);
      expect(classRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { teacherProfile: true } }),
      );
    });

    it('rejects an attachment that is neither an uploaded object nor a valid URL', async () => {
      storage.objectExists.mockResolvedValue(false);
      await expect(
        service.createAssignment(teacher, {
          title: 't',
          dueAt: '2099-01-01',
          classId: 'class-1',
          attachmentUrls: ['not-a-url-or-object-key'],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('notifies every actively-enrolled student when targeting a whole class', async () => {
      enrollmentRepo.find.mockResolvedValue([
        { student: { id: 'student-a' } },
        { student: { id: 'student-b' } },
      ]);
      studentRepo.findOne.mockResolvedValue(null); // no login for either — guardian resolution below still runs
      guardianLinkRepo.find.mockResolvedValue([]);

      await service.createAssignment(teacher, {
        title: 't',
        dueAt: '2099-01-01',
        classId: 'class-1',
      } as any);

      // Two enrolled students, each resolved for notifiable parties — no logins/guardians here,
      // so notify() itself isn't called, but the enrollment lookup driving the fan-out is real.
      expect(enrollmentRepo.find).toHaveBeenCalled();
    });
  });

  describe('createSubmission', () => {
    it('rejects a student the assignment was not targeted at', async () => {
      studentRepo.findOne.mockResolvedValue({ id: 'unrelated-student' });
      enrollmentRepo.findOne.mockResolvedValue(null); // not enrolled in the assignment's class either

      await expect(
        service.createSubmission('assignment-1', student, {
          attachmentUrls: ['https://x.test/a'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(submissionRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a second attempt when the assignment disallows resubmission', async () => {
      submissionRepo.count.mockResolvedValue(1); // already submitted once
      await expect(
        service.createSubmission('assignment-1', student, {
          attachmentUrls: ['https://x.test/a'],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a late submission when the assignment disallows it', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        ...rawAssignment,
        dueAt: new Date('2000-01-01'), // already past
        allowLateSubmission: false,
      });
      await expect(
        service.createSubmission('assignment-1', student, {
          attachmentUrls: ['https://x.test/a'],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('accepts and flags a late submission when the assignment allows it', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        ...rawAssignment,
        dueAt: new Date('2000-01-01'),
        allowLateSubmission: true,
      });

      const result = await service.createSubmission('assignment-1', student, {
        attachmentUrls: ['https://x.test/a'],
      });

      expect(result.isLate).toBe(true);
      expect(submissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isLate: true, attemptNumber: 1 }),
      );
    });
  });

  describe('reviewSubmission', () => {
    const submission = {
      id: 'submission-1',
      assignment: { ...rawAssignment },
      student: { id: 'student-1' },
      attachmentUrls: [],
      grade: null,
      feedback: null,
      status: SubmissionStatus.SUBMITTED,
    };

    it('rejects a teacher who does not own the assignment', async () => {
      submissionRepo.findOne.mockResolvedValue(submission);
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'someone-elses-profile',
      });

      await expect(
        service.reviewSubmission('submission-1', teacher, { grade: 'A' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(submissionRepo.save).not.toHaveBeenCalled();
    });

    it('sets grade/feedback, marks reviewed, and notifies the student', async () => {
      submissionRepo.findOne.mockResolvedValue({ ...submission });
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        user: { id: 'student-user' },
      });

      const result = await service.reviewSubmission('submission-1', teacher, {
        grade: 'A',
        feedback: 'Great work',
      });

      expect(result.status).toBe(SubmissionStatus.REVIEWED);
      expect(submissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          grade: 'A',
          feedback: 'Great work',
          status: SubmissionStatus.REVIEWED,
        }),
      );
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-user',
          type: 'submission_reviewed',
        }),
      );
    });
  });

  describe('listSubmissions', () => {
    const submissionStub = {
      id: 's1',
      assignment: { id: 'assignment-1' },
      student: { id: 'student-1' },
      attachmentUrls: [],
    };

    it('returns every submission to the owning teacher', async () => {
      submissionRepo.find.mockResolvedValue([
        submissionStub,
        { ...submissionStub, id: 's2' },
      ]);
      const result = await service.listSubmissions('assignment-1', teacher);
      expect(result).toHaveLength(2);
    });

    it("returns only the caller's own submissions to a targeted student", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null); // not a teacher
      studentRepo.findOne.mockResolvedValue(studentProfile);
      submissionRepo.find.mockResolvedValue([submissionStub]);

      const result = await service.listSubmissions('assignment-1', student);

      expect(result).toHaveLength(1);
      expect(submissionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { id: studentProfile.id },
          }),
        }),
      );
    });

    it('rejects a student the assignment does not target', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      studentRepo.findOne.mockResolvedValue({ id: 'unrelated-student' });
      enrollmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.listSubmissions('assignment-1', student),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getAssignmentAttachment', () => {
    it('404s for an attachment not on this assignment', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        ...rawAssignment,
        attachmentUrls: ['known-key'],
      });
      await expect(
        service.getAssignmentAttachment('assignment-1', 'unknown-key', teacher),
      ).rejects.toThrow('No such attachment');
    });

    it('denies access to someone with no read access to the assignment', async () => {
      // A real student caller has no teacher profile at all (findByUserId resolves null) — the
      // shared mock otherwise defaults to the owning teacher's profile, which would wrongly
      // grant write access here if left unoverridden.
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      studentRepo.findOne.mockResolvedValue(null); // and isn't the target student either
      await expect(
        service.getAssignmentAttachment('assignment-1', 'known-key', student),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
