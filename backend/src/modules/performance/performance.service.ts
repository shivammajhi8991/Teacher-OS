import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  MetricType,
  PerformanceMetricDefinition,
} from './entities/performance-metric-definition.entity';
import { PerformanceRecord } from './entities/performance-record.entity';
import { TeacherCategory } from '../teacher-profiles/entities/teacher-category.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { Institute } from '../institutes/entities/institute.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { Class } from '../classes/entities/class.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateMetricDefinitionDto } from './dto/create-metric-definition.dto';
import { CreatePerformanceRecordDto } from './dto/create-performance-record.dto';

export interface MetricDefinitionSummary {
  id: string;
  name: string;
  metricType: MetricType;
  unit: string | null;
  scope: 'category' | 'institute' | 'teacher';
}

export interface PerformanceRecordSummary {
  id: string;
  metricDefinitionId: string;
  metricName: string;
  metricType: MetricType;
  unit: string | null;
  classId: string | null;
  value: string;
  recordedAt: Date;
}

// docs/01 §1.4 / docs/03 §3.8 "configurable performance metrics" — no endpoints for this existed
// in docs/04's original sketch (see docs/07-roadmap.md's Phase 5 step 2 entry for the surface
// added here). docs/06 §6.2 gives three separate roles their own "define" scope (super_admin:
// category defaults, institute_admin: institute defaults, teacher: their own) but only the
// teacher can ever "record" a value — institute_admin/super_admin are read-only there, the same
// R-not-F pattern AssignmentsService documents for its own resource.
@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(PerformanceMetricDefinition)
    private readonly definitionRepo: Repository<PerformanceMetricDefinition>,
    @InjectRepository(PerformanceRecord)
    private readonly recordRepo: Repository<PerformanceRecord>,
    @InjectRepository(TeacherCategory)
    private readonly teacherCategoryRepo: Repository<TeacherCategory>,
    @InjectRepository(TeacherProfile)
    private readonly teacherProfileRepo: Repository<TeacherProfile>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    @InjectRepository(StudentTeacherAssignment)
    private readonly assignmentRepo: Repository<StudentTeacherAssignment>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    private readonly teacherProfilesService: TeacherProfilesService,
  ) {}

  // ---------------------------------------------------------------- Metric definitions ---------

  async createMetricDefinition(
    requester: AuthenticatedUser,
    dto: CreateMetricDefinitionDto,
  ): Promise<MetricDefinitionSummary> {
    let definition: PerformanceMetricDefinition;

    if (requester.activeRole === 'super_admin') {
      if (!dto.teacherCategoryId) {
        throw new BadRequestException({
          code: 'TEACHER_CATEGORY_REQUIRED',
          message:
            'super_admin must define a metric against a teacherCategoryId',
        });
      }
      const teacherCategory = await this.teacherCategoryRepo.findOne({
        where: { id: dto.teacherCategoryId },
      });
      if (!teacherCategory) {
        throw new NotFoundException({
          code: 'TEACHER_CATEGORY_NOT_FOUND',
          message: `Teacher category ${dto.teacherCategoryId} not found`,
        });
      }
      definition = this.definitionRepo.create({
        teacherCategory,
        name: dto.name,
        metricType: dto.metricType,
        unit: dto.unit,
      });
    } else if (requester.activeRole === 'institute_admin') {
      if (!requester.instituteId) {
        throw new ForbiddenException({
          code: 'NO_INSTITUTE',
          message:
            'You must belong to an institute to define institute defaults',
        });
      }
      definition = this.definitionRepo.create({
        institute: { id: requester.instituteId } as Institute,
        name: dto.name,
        metricType: dto.metricType,
        unit: dto.unit,
      });
    } else {
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (!teacherProfile) {
        throw new ForbiddenException({
          code: 'NOT_A_TEACHER',
          message:
            'Only a teacher, institute_admin, or super_admin can define a metric',
        });
      }
      definition = this.definitionRepo.create({
        teacherProfile,
        name: dto.name,
        metricType: dto.metricType,
        unit: dto.unit,
      });
    }

    const saved = await this.definitionRepo.save(definition);
    return this.toDefinitionSummary(saved);
  }

  // The definitions a teacher can actually record against right now: their own, their
  // institute's defaults, and their category's defaults. institute_admin/super_admin get a
  // broader oversight view (institute+category, or everything, respectively) rather than this
  // "what can I use to record a value" scoping, since they never record values themselves.
  async listApplicableDefinitions(
    requester: AuthenticatedUser,
  ): Promise<MetricDefinitionSummary[]> {
    if (
      requester.activeRole === 'student' ||
      requester.activeRole === 'parent'
    ) {
      return [];
    }

    let definitions: PerformanceMetricDefinition[];
    if (requester.activeRole === 'super_admin') {
      definitions = await this.definitionRepo.find({
        relations: {
          teacherCategory: true,
          institute: true,
          teacherProfile: true,
        },
      });
    } else if (requester.activeRole === 'institute_admin') {
      if (!requester.instituteId) return [];
      // Two separate queries rather than one OR'd `where` array — "any category-scoped row" and
      // "this specific institute's rows" filter on different, unrelated columns, which a single
      // find() where-array can express, but a not-null check on a relation reads more clearly as
      // its own query.
      const [instituteDefaults, categoryDefaults] = await Promise.all([
        this.definitionRepo.find({
          where: { institute: { id: requester.instituteId } },
          relations: { institute: true },
        }),
        this.definitionRepo.find({
          where: { teacherCategory: Not(IsNull()) },
          relations: { teacherCategory: true },
        }),
      ]);
      definitions = [...instituteDefaults, ...categoryDefaults];
    } else {
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (!teacherProfile) return [];
      const full = await this.getTeacherProfileWithScope(teacherProfile.id);
      const [own, institute, category] = await Promise.all([
        this.definitionRepo.find({
          where: { teacherProfile: { id: teacherProfile.id } },
        }),
        full?.institute?.id
          ? this.definitionRepo.find({
              where: { institute: { id: full.institute.id } },
            })
          : Promise.resolve([]),
        full?.teacherCategory?.id
          ? this.definitionRepo.find({
              where: { teacherCategory: { id: full.teacherCategory.id } },
            })
          : Promise.resolve([]),
      ]);
      definitions = [...own, ...institute, ...category];
    }

    return definitions.map((d) => this.toDefinitionSummary(d));
  }

  // ---------------------------------------------------------------- Recording ------------------

  async recordPerformance(
    requester: AuthenticatedUser,
    dto: CreatePerformanceRecordDto,
  ): Promise<PerformanceRecordSummary> {
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (!teacherProfile) {
      throw new ForbiddenException({
        code: 'NOT_A_TEACHER',
        message: 'Only a teacher can record a performance value',
      });
    }

    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${dto.studentId} not found`,
      });
    }
    const assignment = await this.assignmentRepo.findOne({
      where: {
        student: { id: student.id },
        teacherProfile: { id: teacherProfile.id },
      },
    });
    if (!assignment) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_STUDENT',
        message: 'You are not assigned to this student',
      });
    }

    const definition = await this.definitionRepo.findOne({
      where: { id: dto.metricDefinitionId },
      relations: {
        teacherCategory: true,
        institute: true,
        teacherProfile: true,
      },
    });
    if (!definition) {
      throw new NotFoundException({
        code: 'METRIC_DEFINITION_NOT_FOUND',
        message: `Metric definition ${dto.metricDefinitionId} not found`,
      });
    }
    if (
      !(await this.isDefinitionApplicableToTeacher(
        definition,
        teacherProfile.id,
      ))
    ) {
      throw new ForbiddenException({
        code: 'METRIC_NOT_APPLICABLE',
        message: 'This metric is not available to you',
      });
    }

    this.assertValueMatchesType(dto.value, definition.metricType);

    let cls: Class | null = null;
    if (dto.classId) {
      cls = await this.classRepo.findOne({ where: { id: dto.classId } });
      if (!cls || cls.teacherProfile.id !== teacherProfile.id) {
        throw new ForbiddenException({
          code: 'NOT_AUTHORIZED_FOR_CLASS',
          message: 'You do not teach this class',
        });
      }
    }

    const record = await this.recordRepo.save(
      this.recordRepo.create({
        student,
        metricDefinition: definition,
        class: cls,
        value: dto.value,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        recordedBy: { id: requester.userId } as User,
      }),
    );

    return this.toRecordSummary({ ...record, metricDefinition: definition });
  }

  async getStudentPerformance(
    studentId: string,
    requester: AuthenticatedUser,
  ): Promise<PerformanceRecordSummary[]> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: { user: true, institute: true },
      select: { id: true, user: { id: true }, institute: { id: true } },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${studentId} not found`,
      });
    }
    if (!(await this.hasStudentPerformanceAccess(student, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_PERFORMANCE',
        message: "You do not have access to this student's performance records",
      });
    }

    const records = await this.recordRepo.find({
      where: { student: { id: studentId } },
      relations: { metricDefinition: true },
      order: { recordedAt: 'DESC' },
    });
    return records.map((r) => this.toRecordSummary(r));
  }

  // ---------------------------------------------------------------- Access control -------------

  private async isDefinitionApplicableToTeacher(
    definition: PerformanceMetricDefinition,
    teacherProfileId: string,
  ): Promise<boolean> {
    if (definition.teacherProfile?.id === teacherProfileId) return true;
    if (definition.teacherCategory || definition.institute) {
      const full = await this.getTeacherProfileWithScope(teacherProfileId);
      if (
        definition.teacherCategory &&
        full?.teacherCategory?.id === definition.teacherCategory.id
      ) {
        return true;
      }
      if (
        definition.institute &&
        full?.institute?.id === definition.institute.id
      ) {
        return true;
      }
    }
    return false;
  }

  // TeacherProfilesService.findById()/findByUserId() are shaped for their own controller's
  // response needs (select-restricted, no `institute` relation loaded) — this module needs the
  // teacher's own category (already eager on the entity) and institute to resolve which
  // category-/institute-scoped definitions apply to them, so it queries the repository directly
  // rather than reusing those methods, matching how every other module (Fees, Notes,
  // Assignments) fetches its own shape from shared entities instead of routing through another
  // module's service.
  private async getTeacherProfileWithScope(
    teacherProfileId: string,
  ): Promise<TeacherProfile | null> {
    return this.teacherProfileRepo.findOne({
      where: { id: teacherProfileId },
      relations: { institute: true },
    });
  }

  // Mirrors FeesService.hasStudentFinanceAccess / AttendanceService's equivalent — duplicated per
  // module by design, see attendance.service.ts's comment on the same pattern.
  private async hasStudentPerformanceAccess(
    student: StudentProfile,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (requester.activeRole === 'super_admin') return true;
    if (
      requester.activeRole === 'institute_admin' &&
      student.institute?.id &&
      student.institute.id === requester.instituteId
    ) {
      return true;
    }
    if (student.user?.id === requester.userId) return true;

    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (teacherProfile) {
      const assignment = await this.assignmentRepo.findOne({
        where: {
          student: { id: student.id },
          teacherProfile: { id: teacherProfile.id },
        },
      });
      if (assignment) return true;
    }

    const guardianLink = await this.guardianLinkRepo.findOne({
      where: {
        student: { id: student.id },
        guardian: { user: { id: requester.userId } },
      },
    });
    return !!guardianLink;
  }

  // ---------------------------------------------------------------- Validation -----------------

  // Real, tested logic — `value` is a plain string column (see performance-record.entity.ts's
  // header comment for why), so this is the only thing standing between a metric's declared type
  // and garbage data (a "scale_1_5" of "7", a "pass_fail" of "maybe").
  private assertValueMatchesType(value: string, metricType: MetricType): void {
    const invalid = (): never => {
      throw new BadRequestException({
        code: 'INVALID_METRIC_VALUE',
        message: `"${value}" is not a valid value for a ${metricType} metric`,
      });
    };

    switch (metricType) {
      case MetricType.NUMERIC: {
        if (!Number.isFinite(Number(value))) invalid();
        break;
      }
      case MetricType.PERCENTAGE: {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 100) invalid();
        break;
      }
      case MetricType.SCALE_1_5: {
        if (!['1', '2', '3', '4', '5'].includes(value)) invalid();
        break;
      }
      case MetricType.PASS_FAIL: {
        if (!['pass', 'fail'].includes(value)) invalid();
        break;
      }
      case MetricType.TEXT: {
        if (value.trim().length === 0) invalid();
        break;
      }
    }
  }

  // ---------------------------------------------------------------- Shaping ----------------------

  private toDefinitionSummary(
    definition: PerformanceMetricDefinition,
  ): MetricDefinitionSummary {
    const scope: MetricDefinitionSummary['scope'] = definition.teacherCategory
      ? 'category'
      : definition.institute
        ? 'institute'
        : 'teacher';
    return {
      id: definition.id,
      name: definition.name,
      metricType: definition.metricType,
      unit: definition.unit ?? null,
      scope,
    };
  }

  private toRecordSummary(record: PerformanceRecord): PerformanceRecordSummary {
    return {
      id: record.id,
      metricDefinitionId: record.metricDefinition.id,
      metricName: record.metricDefinition.name,
      metricType: record.metricDefinition.metricType,
      unit: record.metricDefinition.unit ?? null,
      classId: record.class?.id ?? null,
      value: record.value,
      recordedAt: record.recordedAt,
    };
  }
}
