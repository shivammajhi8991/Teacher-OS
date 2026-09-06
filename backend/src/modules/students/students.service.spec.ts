import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { StudentsService } from './students.service';
import {
  StudentProfile,
  EnrollmentStatus,
} from './entities/student-profile.entity';
import { StudentGuardianLink } from './entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from './entities/student-teacher-assignment.entity';
import { StudentInvite } from './entities/student-invite.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/05 §5.7-equivalent for the backend: these cover the edge cases docs/01 §1.3/§1.5 call out
// explicitly — "teacher deletes a student with financial history" (→ archive, never delete),
// "duplicate student records" (→ merge dedup), and the access-control boundary that makes "own
// students only" actually mean something.
describe('StudentsService', () => {
  let service: StudentsService;
  const studentRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
  const guardianLinkRepo = { findOne: jest.fn(), find: jest.fn() };
  const assignmentRepo = { findOne: jest.fn(), find: jest.fn() };
  const inviteRepo = { create: jest.fn(), save: jest.fn() };
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
        StudentsService,
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        {
          provide: getRepositoryToken(StudentTeacherAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(StudentInvite), useValue: inviteRepo },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get(StudentsService);
  });

  describe('create', () => {
    it('rejects a caller with no teacher profile', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);

      await expect(
        service.create('user-1', { fullName: 'New Student' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns an empty list for a caller with no teacher profile (e.g. a student/parent)', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);

      const result = await service.findAll(
        { userId: 'user-student', activeRole: 'student', instituteId: null },
        {},
      );

      expect(result).toEqual([]);
      expect(studentRepo.find).not.toHaveBeenCalled();
    });

    it('scopes an institute_admin with no institute to an empty list rather than everything', async () => {
      const result = await service.findAll(
        { userId: 'admin-1', activeRole: 'institute_admin', instituteId: null },
        {},
      );

      expect(result).toEqual([]);
      expect(studentRepo.find).not.toHaveBeenCalled();
    });

    it("returns a parent's own linked children, discovered via their guardian links", async () => {
      guardianLinkRepo.find.mockResolvedValue([
        { student: { id: 'child-1' } },
        { student: { id: 'child-2' } },
      ]);
      studentRepo.find.mockResolvedValue([
        { id: 'child-1' },
        { id: 'child-2' },
      ]);

      const result = await service.findAll(
        { userId: 'user-parent', activeRole: 'parent', instituteId: null },
        {},
      );

      expect(guardianLinkRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guardian: { user: { id: 'user-parent' } } },
        }),
      );
      expect(studentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: expect.anything() } }),
      );
      expect(result).toHaveLength(2);
    });

    it('returns an empty list for a parent with no linked children, without ever querying students', async () => {
      guardianLinkRepo.find.mockResolvedValue([]);

      const result = await service.findAll(
        { userId: 'user-parent', activeRole: 'parent', instituteId: null },
        {},
      );

      expect(result).toEqual([]);
      expect(studentRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it("rejects a teacher who isn't assigned to the student", async () => {
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        institute: null,
        enrollmentStatus: EnrollmentStatus.ACTIVE,
      });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      assignmentRepo.findOne.mockResolvedValue(null); // no active assignment for this teacher

      await expect(
        service.archive('student-1', teacher),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(studentRepo.save).not.toHaveBeenCalled();
    });

    it('archives (never hard-deletes) when the caller is the assigned teacher', async () => {
      const student = {
        id: 'student-1',
        institute: null,
        enrollmentStatus: EnrollmentStatus.ACTIVE,
        statusChangedAt: new Date('2026-01-01'),
      };
      studentRepo.findOne.mockResolvedValue(student);
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      assignmentRepo.findOne.mockResolvedValue({ id: 'assignment-1' }); // active assignment exists
      studentRepo.save.mockImplementation((s) => Promise.resolve(s));

      await service.archive('student-1', teacher);

      expect(student.enrollmentStatus).toBe(EnrollmentStatus.ARCHIVED);
      expect(studentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollmentStatus: EnrollmentStatus.ARCHIVED,
        }),
      );
    });
  });

  describe('mergeStudents', () => {
    it('rejects merging a student into itself', async () => {
      await expect(
        service.mergeStudents(teacher, {
          survivingStudentId: 'same-id',
          mergedStudentId: 'same-id',
          reason: 'oops',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(studentRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects merging when the caller lacks write access to either record', async () => {
      studentRepo.findOne
        .mockResolvedValueOnce({
          id: 'survivor',
          institute: null,
          enrollmentStatus: 'active',
        })
        .mockResolvedValueOnce({
          id: 'merged',
          institute: null,
          enrollmentStatus: 'active',
        });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      assignmentRepo.findOne.mockResolvedValue(null); // not assigned to either student

      await expect(
        service.mergeStudents(teacher, {
          survivingStudentId: 'survivor',
          mergedStudentId: 'merged',
          reason: 'duplicate entry',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
