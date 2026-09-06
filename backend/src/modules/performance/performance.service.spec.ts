import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PerformanceService } from './performance.service';
import {
  MetricType,
  PerformanceMetricDefinition,
} from './entities/performance-metric-definition.entity';
import { PerformanceRecord } from './entities/performance-record.entity';
import { TeacherCategory } from '../teacher-profiles/entities/teacher-category.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { Class } from '../classes/entities/class.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/01 §1.4 "configurable performance metrics" — the interesting logic is which scope a
// definition resolves to per role (docs/06 §6.2's three separate "define" grants), whether a
// definition is actually usable by a given teacher, the per-metric-type value validation, and
// the student-performance read-access matrix shared in shape with Fees/Attendance.
describe('PerformanceService', () => {
  let service: PerformanceService;
  const definitionRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'def-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const recordRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'record-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
  };
  const teacherCategoryRepo = { findOne: jest.fn() };
  const teacherProfileRepo = { findOne: jest.fn() };
  const studentRepo = { findOne: jest.fn() };
  const guardianLinkRepo = { findOne: jest.fn().mockResolvedValue(null) };
  const assignmentRepo = { findOne: jest.fn() };
  const classRepo = { findOne: jest.fn() };
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
  const instituteAdmin: AuthenticatedUser = {
    userId: 'user-admin',
    activeRole: 'institute_admin',
    instituteId: 'inst-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: getRepositoryToken(PerformanceMetricDefinition),
          useValue: definitionRepo,
        },
        {
          provide: getRepositoryToken(PerformanceRecord),
          useValue: recordRepo,
        },
        {
          provide: getRepositoryToken(TeacherCategory),
          useValue: teacherCategoryRepo,
        },
        {
          provide: getRepositoryToken(TeacherProfile),
          useValue: teacherProfileRepo,
        },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        {
          provide: getRepositoryToken(StudentTeacherAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
      ],
    }).compile();

    service = module.get(PerformanceService);

    // Safe, explicit defaults — jest.clearAllMocks() drops call history but not a mock's
    // last-set resolved value, so every test below only overrides what it actually needs.
    teacherProfilesService.findByUserId.mockResolvedValue({
      id: 'teacher-profile-1',
    });
    teacherProfileRepo.findOne.mockResolvedValue({
      id: 'teacher-profile-1',
      teacherCategory: { id: 'category-1' },
      institute: { id: 'inst-1' },
    });
    studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    assignmentRepo.findOne.mockResolvedValue({ id: 'assignment-1' });
    guardianLinkRepo.findOne.mockResolvedValue(null);
    classRepo.findOne.mockResolvedValue({
      id: 'class-1',
      teacherProfile: { id: 'teacher-profile-1' },
    });
  });

  describe('createMetricDefinition', () => {
    it('requires a teacherCategoryId from a super_admin', async () => {
      const superAdmin: AuthenticatedUser = {
        userId: 'u',
        activeRole: 'super_admin',
        instituteId: null,
      };
      await expect(
        service.createMetricDefinition(superAdmin, {
          name: 'x',
          metricType: MetricType.NUMERIC,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("scopes an institute_admin's definition to their own institute", async () => {
      await service.createMetricDefinition(instituteAdmin, {
        name: 'Attendance streak',
        metricType: MetricType.NUMERIC,
      });
      expect(definitionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ institute: { id: 'inst-1' } }),
      );
    });

    it("scopes a teacher's definition to their own profile", async () => {
      await service.createMetricDefinition(teacher, {
        name: 'Effort',
        metricType: MetricType.SCALE_1_5,
      });
      expect(definitionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          teacherProfile: { id: 'teacher-profile-1' },
        }),
      );
    });

    it('rejects a caller with no teacher profile and no admin role', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      await expect(
        service.createMetricDefinition(teacher, {
          name: 'x',
          metricType: MetricType.TEXT,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('recordPerformance', () => {
    const baseDto = {
      studentId: 'student-1',
      metricDefinitionId: 'def-1',
      value: '4',
    };

    it('rejects a caller with no teacher profile', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      await expect(
        service.recordPerformance(teacher, baseDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a teacher not assigned to the student', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.recordPerformance(teacher, baseDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(recordRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a metric definition that isn't applicable to this teacher", async () => {
      definitionRepo.findOne.mockResolvedValue({
        id: 'def-1',
        metricType: MetricType.SCALE_1_5,
        teacherCategory: { id: 'someone-elses-category' },
        institute: null,
        teacherProfile: null,
      });
      await expect(
        service.recordPerformance(teacher, baseDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each([
      [MetricType.NUMERIC, 'not-a-number', false],
      [MetricType.NUMERIC, '12.5', true],
      [MetricType.PERCENTAGE, '150', false],
      [MetricType.PERCENTAGE, '85', true],
      [MetricType.SCALE_1_5, '7', false],
      [MetricType.SCALE_1_5, '3', true],
      [MetricType.PASS_FAIL, 'maybe', false],
      [MetricType.PASS_FAIL, 'pass', true],
      [MetricType.TEXT, '', false],
      [MetricType.TEXT, 'Great improvement', true],
    ])(
      'validates a %s value of "%s" → accepted: %s',
      async (metricType, value, shouldAccept) => {
        definitionRepo.findOne.mockResolvedValue({
          id: 'def-1',
          metricType,
          teacherCategory: null,
          institute: null,
          teacherProfile: { id: 'teacher-profile-1' },
        });

        const attempt = service.recordPerformance(teacher, {
          ...baseDto,
          value,
        });
        if (shouldAccept) {
          await expect(attempt).resolves.toBeDefined();
        } else {
          await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
        }
      },
    );

    it('rejects a classId for a class the teacher does not teach', async () => {
      definitionRepo.findOne.mockResolvedValue({
        id: 'def-1',
        metricType: MetricType.TEXT,
        teacherCategory: null,
        institute: null,
        teacherProfile: { id: 'teacher-profile-1' },
      });
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        teacherProfile: { id: 'someone-elses-profile' },
      });

      await expect(
        service.recordPerformance(teacher, {
          ...baseDto,
          value: 'ok',
          classId: 'class-1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // A mocked classRepo doesn't care what `relations` a real TypeORM call asked for — it always
    // returns whatever the test told it to. So the ownership check above can pass every unit
    // test here while still crashing for real (Class.teacherProfile isn't `eager`, so a
    // findOne() without `relations: { teacherProfile: true }` leaves it undefined) — exactly
    // what a live-Postgres smoke test caught for this exact call site. Asserting the actual
    // find() options is the unit-test-level guard against that regressing silently again.
    it('loads the class with its teacherProfile relation (not eager)', async () => {
      definitionRepo.findOne.mockResolvedValue({
        id: 'def-1',
        metricType: MetricType.TEXT,
        teacherCategory: null,
        institute: null,
        teacherProfile: { id: 'teacher-profile-1' },
      });

      await service.recordPerformance(teacher, {
        ...baseDto,
        value: 'ok',
        classId: 'class-1',
      });

      expect(classRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { teacherProfile: true } }),
      );
    });
  });

  describe('getStudentPerformance', () => {
    const fullStudent = {
      id: 'student-1',
      user: { id: 'student-user' },
      institute: { id: 'inst-1' },
    };

    it('grants access to the student themselves', async () => {
      studentRepo.findOne.mockResolvedValue(fullStudent);
      const selfRequester: AuthenticatedUser = {
        userId: 'student-user',
        activeRole: 'student',
        instituteId: null,
      };
      await expect(
        service.getStudentPerformance('student-1', selfRequester),
      ).resolves.toBeDefined();
    });

    it('denies a stranger with no relationship to the student', async () => {
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        user: { id: 'someone-else' },
        institute: null,
      });
      assignmentRepo.findOne.mockResolvedValue(null);
      guardianLinkRepo.findOne.mockResolvedValue(null);
      const stranger: AuthenticatedUser = {
        userId: 'random-user',
        activeRole: 'parent',
        instituteId: null,
      };
      await expect(
        service.getStudentPerformance('student-1', stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('grants access to a same-institute institute_admin', async () => {
      studentRepo.findOne.mockResolvedValue(fullStudent);
      await expect(
        service.getStudentPerformance('student-1', instituteAdmin),
      ).resolves.toBeDefined();
    });
  });

  describe('listApplicableDefinitions', () => {
    it('returns nothing for student/parent — they never define or record', async () => {
      const result = await service.listApplicableDefinitions(student);
      expect(result).toEqual([]);
      expect(definitionRepo.find).not.toHaveBeenCalled();
    });

    it("combines a teacher's own, institute, and category definitions", async () => {
      definitionRepo.find
        .mockResolvedValueOnce([
          { id: 'own-1', teacherProfile: { id: 'teacher-profile-1' } },
        ])
        .mockResolvedValueOnce([{ id: 'inst-1', institute: { id: 'inst-1' } }])
        .mockResolvedValueOnce([
          { id: 'cat-1', teacherCategory: { id: 'category-1' } },
        ]);

      const result = await service.listApplicableDefinitions(teacher);

      expect(result.map((d) => d.id)).toEqual(['own-1', 'inst-1', 'cat-1']);
    });
  });
});
