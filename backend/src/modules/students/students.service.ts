import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  Repository,
} from 'typeorm';
import { randomBytes } from 'crypto';
import {
  StudentProfile,
  EnrollmentStatus,
  StudentSource,
} from './entities/student-profile.entity';
import { Guardian } from './entities/guardian.entity';
import { StudentGuardianLink } from './entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from './entities/student-teacher-assignment.entity';
import { StudentMergeLog } from './entities/student-merge-log.entity';
import { StudentInvite } from './entities/student-invite.entity';
import { Institute } from '../institutes/entities/institute.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { GuardianInputDto } from './dto/guardian-input.dto';
import { MergeStudentsDto } from './dto/merge-students.dto';
import { CreateInviteDto } from './dto/create-invite.dto';

// docs/03 §3.1 — the `select` restriction below on the `user` relation is the same lesson learned
// on teacher-profiles: never let a related User ride along fully-loaded into a response, because
// its passwordHash goes wherever the entity gets serialized.
// Shared response shape for "a guardian, in the context of one student" — returned by both
// getStudentDetail() (one per linked guardian) and addGuardian() (docs/04 §4.4), so the mobile
// client parses one shape regardless of which endpoint it came from.
export interface GuardianSummary {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  relationship?: string;
  isPrimary: boolean;
  consentDataSharing: boolean;
}

export interface InviteSummary {
  code: string;
  expiresAt: Date | null;
}

const STUDENT_SELECT = {
  id: true,
  fullName: true,
  dob: true,
  gender: true,
  avatarUrl: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  medicalNotes: true,
  joinDate: true,
  enrollmentStatus: true,
  statusChangedAt: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  user: { id: true },
  institute: { id: true, name: true },
} as const;

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    @InjectRepository(StudentTeacherAssignment)
    private readonly assignmentRepo: Repository<StudentTeacherAssignment>,
    @InjectRepository(StudentInvite)
    private readonly inviteRepo: Repository<StudentInvite>,
    private readonly teacherProfilesService: TeacherProfilesService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    requesterUserId: string,
    dto: CreateStudentDto,
  ): Promise<StudentProfile> {
    const teacherProfile =
      await this.teacherProfilesService.findByUserId(requesterUserId);
    if (!teacherProfile) {
      // docs/01 §1.6 real-world ordering: onboarding (docs/07 step 2) happens before a teacher
      // can have students — TODO(docs/07 Phase 5): an institute_admin adding a student on behalf
      // of one of their teachers needs its own path once institute-scoped teacher lookup exists.
      throw new ForbiddenException({
        code: 'TEACHER_PROFILE_REQUIRED',
        message: 'Complete your teacher profile before adding students',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const student = manager.create(StudentProfile, {
        institute: teacherProfile.institute ?? null,
        fullName: dto.fullName,
        dob: dto.dob,
        gender: dto.gender,
        avatarUrl: dto.avatarUrl,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        medicalNotes: dto.medicalNotes,
        joinDate: dto.joinDate ?? new Date().toISOString().slice(0, 10),
        statusChangedAt: new Date(),
        source: StudentSource.MANUAL,
      });
      await manager.save(student);

      await manager.save(
        manager.create(StudentTeacherAssignment, {
          student,
          teacherProfile,
          assignedFrom: new Date(),
        }),
      );

      if (dto.guardians?.length) {
        for (const [index, guardianInput] of dto.guardians.entries()) {
          const guardian = await this.findOrCreateGuardian(
            manager,
            guardianInput,
            teacherProfile.institute?.id ?? null,
          );
          await manager.save(
            manager.create(StudentGuardianLink, {
              student,
              guardian,
              isPrimary: guardianInput.isPrimary ?? index === 0,
              consentDataSharing: guardianInput.consentDataSharing ?? false,
              consentRecordedAt: guardianInput.consentDataSharing
                ? new Date()
                : null,
            }),
          );
        }
      }

      return student;
    });
  }

  async findAll(
    requester: AuthenticatedUser,
    filters: { status?: EnrollmentStatus; q?: string },
  ): Promise<StudentProfile[]> {
    if (
      requester.activeRole === 'super_admin' ||
      requester.activeRole === 'institute_admin'
    ) {
      const where: FindOptionsWhere<StudentProfile> = {};
      if (requester.activeRole === 'institute_admin') {
        if (!requester.instituteId) return [];
        where.institute = { id: requester.instituteId };
      }
      if (filters.status) where.enrollmentStatus = filters.status;
      if (filters.q) where.fullName = ILike(`%${filters.q}%`);
      return this.studentRepo.find({
        where,
        select: STUDENT_SELECT,
        order: { fullName: 'ASC' },
      });
    }

    // docs/07 roadmap Phase 5 step 3 "Parent dashboard" — a parent's own linked children
    // (docs/06 §6.2 "O (linked child)"), the list this app's Child switcher and dashboard both
    // need to even know which student ids exist for this parent in the first place. Previously
    // missing entirely: this method fell through to the teacher branch below for a parent
    // caller (findByUserId correctly returns null for them, but that just meant an empty list —
    // there was no way for a parent to discover their children's ids at all before this).
    if (requester.activeRole === 'parent') {
      const links = await this.guardianLinkRepo.find({
        where: { guardian: { user: { id: requester.userId } } },
        relations: { student: true },
      });
      const studentIds = links.map((l) => l.student.id);
      if (studentIds.length === 0) return [];

      const where: FindOptionsWhere<StudentProfile> = { id: In(studentIds) };
      if (filters.status) where.enrollmentStatus = filters.status;
      if (filters.q) where.fullName = ILike(`%${filters.q}%`);
      return this.studentRepo.find({
        where,
        select: STUDENT_SELECT,
        order: { fullName: 'ASC' },
      });
    }

    // Teacher (default): scoped to their own active assignments only (docs/06 §6.2 "F (own
    // students)"). A student caller falls through here too — findByUserId returns null for
    // them (they hold no teacher profile), so this correctly resolves to an empty list rather
    // than every student in the system.
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (!teacherProfile) return [];

    const assignments = await this.assignmentRepo.find({
      where: {
        teacherProfile: { id: teacherProfile.id },
        assignedTo: IsNull(),
      },
      relations: { student: true },
    });
    const studentIds = assignments.map((a) => a.student.id);
    if (studentIds.length === 0) return [];

    const where: FindOptionsWhere<StudentProfile> = { id: In(studentIds) };
    if (filters.status) where.enrollmentStatus = filters.status;
    if (filters.q) where.fullName = ILike(`%${filters.q}%`);
    return this.studentRepo.find({
      where,
      select: STUDENT_SELECT,
      order: { fullName: 'ASC' },
    });
  }

  // docs/04 §4.4 "full profile incl. attendance/fee/notes summary" — attendance/fee/notes don't
  // exist yet (docs/07 steps 5–7), so this returns what does: the profile plus guardians and
  // teacher assignments. Extending it once those modules ship is additive, not a rewrite.
  async getStudentDetail(id: string, requester: AuthenticatedUser) {
    const student = await this.getRawById(id);
    if (!(await this.hasReadAccess(student, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_STUDENT',
        message: 'You do not have access to this student',
      });
    }

    const [guardianLinks, assignments] = await Promise.all([
      this.guardianLinkRepo.find({
        where: { student: { id } },
        relations: { guardian: true },
      }),
      this.assignmentRepo.find({
        where: { student: { id } },
        relations: { teacherProfile: true },
        order: { assignedFrom: 'DESC' },
      }),
    ]);

    return {
      ...student,
      guardians: guardianLinks.map((link) => this.toGuardianSummary(link)),
      teacherAssignments: assignments.map((a) => ({
        id: a.id,
        teacherProfileId: a.teacherProfile.id,
        subjectOrSkill: a.subjectOrSkill,
        assignedFrom: a.assignedFrom,
        assignedTo: a.assignedTo,
      })),
    };
  }

  async update(
    id: string,
    requester: AuthenticatedUser,
    dto: UpdateStudentDto,
  ): Promise<StudentProfile> {
    const student = await this.getRawById(id);
    await this.assertWriteAccess(student, requester);

    const statusChanging =
      dto.enrollmentStatus !== undefined &&
      dto.enrollmentStatus !== student.enrollmentStatus;

    Object.assign(student, {
      fullName: dto.fullName ?? student.fullName,
      dob: dto.dob ?? student.dob,
      gender: dto.gender ?? student.gender,
      avatarUrl: dto.avatarUrl ?? student.avatarUrl,
      emergencyContactName:
        dto.emergencyContactName ?? student.emergencyContactName,
      emergencyContactPhone:
        dto.emergencyContactPhone ?? student.emergencyContactPhone,
      medicalNotes: dto.medicalNotes ?? student.medicalNotes,
      enrollmentStatus: dto.enrollmentStatus ?? student.enrollmentStatus,
    });
    if (statusChanging) student.statusChangedAt = new Date();

    return this.studentRepo.save(student);
  }

  // docs/01 §1.3 "archive old students instead of permanently deleting them" — never touches
  // `deletedAt`; see student-profile.entity.ts for why the two are kept distinct.
  async archive(id: string, requester: AuthenticatedUser): Promise<void> {
    const student = await this.getRawById(id);
    await this.assertWriteAccess(student, requester);
    student.enrollmentStatus = EnrollmentStatus.ARCHIVED;
    student.statusChangedAt = new Date();
    await this.studentRepo.save(student);
  }

  async addGuardian(
    studentId: string,
    requester: AuthenticatedUser,
    dto: GuardianInputDto,
  ): Promise<GuardianSummary> {
    const student = await this.getRawById(studentId);
    await this.assertWriteAccess(student, requester);

    return this.dataSource.transaction(async (manager) => {
      const guardian = await this.findOrCreateGuardian(
        manager,
        dto,
        student.institute?.id ?? null,
      );
      const existingLink = await manager.findOne(StudentGuardianLink, {
        where: { student: { id: studentId }, guardian: { id: guardian.id } },
      });
      if (existingLink) {
        throw new ConflictException({
          code: 'GUARDIAN_ALREADY_LINKED',
          message: 'This guardian is already linked to this student',
        });
      }
      const link = manager.create(StudentGuardianLink, {
        student,
        guardian,
        isPrimary: dto.isPrimary ?? false,
        consentDataSharing: dto.consentDataSharing ?? false,
        consentRecordedAt: dto.consentDataSharing ? new Date() : null,
      });
      await manager.save(link);
      // Shaped to match getStudentDetail()'s flattened `guardians` entries exactly (docs/04
      // §4.4) — the raw StudentGuardianLink entity would nest `guardian` one level deeper and
      // redundantly embed the whole (pruned) student, giving the two endpoints different shapes
      // for the same conceptual "guardian on a student" object.
      return this.toGuardianSummary(link);
    });
  }

  // docs/01 §1.3 "duplicate student records" resolution policy: an explicit, audited merge, never
  // a silent delete. Attendance/fee/notes reassignment (docs/03 §3.6–§3.8) extends this once
  // those tables exist — each would add one more "reassign, skip on conflict" block below.
  async mergeStudents(
    requester: AuthenticatedUser,
    dto: MergeStudentsDto,
  ): Promise<StudentProfile> {
    if (dto.survivingStudentId === dto.mergedStudentId) {
      throw new BadRequestException({
        code: 'CANNOT_MERGE_SAME_STUDENT',
        message: 'A student cannot be merged into itself',
      });
    }

    const surviving = await this.getRawById(dto.survivingStudentId);
    const merged = await this.getRawById(dto.mergedStudentId);
    await this.assertWriteAccess(surviving, requester);
    await this.assertWriteAccess(merged, requester);

    if (merged.enrollmentStatus === EnrollmentStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'STUDENT_ALREADY_ARCHIVED',
        message: 'The record being merged away is already archived',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const mergedAssignments = await manager.find(StudentTeacherAssignment, {
        where: { student: { id: merged.id } },
        relations: { teacherProfile: true },
      });
      for (const assignment of mergedAssignments) {
        const alreadyAssigned = await manager.findOne(
          StudentTeacherAssignment,
          {
            where: {
              student: { id: surviving.id },
              teacherProfile: { id: assignment.teacherProfile.id },
              assignedTo: IsNull(),
            },
          },
        );
        if (alreadyAssigned) continue; // surviving student already has this teacher — drop the dup
        assignment.student = surviving;
        await manager.save(assignment);
      }

      const mergedLinks = await manager.find(StudentGuardianLink, {
        where: { student: { id: merged.id } },
        relations: { guardian: true },
      });
      for (const link of mergedLinks) {
        const alreadyLinked = await manager.findOne(StudentGuardianLink, {
          where: {
            student: { id: surviving.id },
            guardian: { id: link.guardian.id },
          },
        });
        if (alreadyLinked) continue; // unique (student, guardian) index — skip the duplicate
        link.student = surviving;
        await manager.save(link);
      }

      merged.enrollmentStatus = EnrollmentStatus.ARCHIVED;
      merged.statusChangedAt = new Date();
      await manager.save(merged);

      await manager.save(
        manager.create(StudentMergeLog, {
          survivingStudent: surviving,
          mergedStudent: merged,
          mergedBy: { id: requester.userId } as User,
          reason: dto.reason,
        }),
      );

      return surviving;
    });
  }

  // docs/04 §4.4 POST /students/invite. Code generation only — redemption is a documented
  // follow-up, see student-invite.entity.ts.
  async createInvite(
    requester: AuthenticatedUser,
    dto: CreateInviteDto,
  ): Promise<InviteSummary> {
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (!teacherProfile) {
      throw new ForbiddenException({
        code: 'TEACHER_PROFILE_REQUIRED',
        message: 'Complete your teacher profile before inviting students',
      });
    }

    const code = randomBytes(5).toString('hex'); // 10 hex chars — plenty for this invite volume
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const invite = this.inviteRepo.create({
      code,
      createdByTeacher: teacherProfile,
      institute: teacherProfile.institute ?? null,
      expiresAt,
    });
    const saved = await this.inviteRepo.save(invite);
    // Shaped, not the raw entity — `invite.createdByTeacher` holds a full TeacherProfile (with
    // its eager teacherCategory) that the client has no use for here (docs/04 §4.4 only promises
    // "generates link/code").
    return { code: saved.code, expiresAt: saved.expiresAt ?? null };
  }

  private toGuardianSummary(link: StudentGuardianLink): GuardianSummary {
    return {
      id: link.guardian.id,
      fullName: link.guardian.fullName,
      phone: link.guardian.phone,
      email: link.guardian.email,
      relationship: link.guardian.relationship,
      isPrimary: link.isPrimary,
      consentDataSharing: link.consentDataSharing,
    };
  }

  private async findOrCreateGuardian(
    manager: EntityManager,
    input: GuardianInputDto,
    instituteId: string | null,
  ): Promise<Guardian> {
    if (input.phone || input.email) {
      const existing = await manager.findOne(Guardian, {
        where: [
          ...(input.phone ? [{ phone: input.phone }] : []),
          ...(input.email ? [{ email: input.email }] : []),
        ],
      });
      if (existing) return existing;
    }
    const guardian = manager.create(Guardian, {
      institute: instituteId ? ({ id: instituteId } as Institute) : null,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      relationship: input.relationship,
    });
    return manager.save(guardian);
  }

  private async getRawById(id: string): Promise<StudentProfile> {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: { user: true, institute: true },
      select: STUDENT_SELECT,
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${id} not found`,
      });
    }
    return student;
  }

  private async hasReadAccess(
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
    if (student.user?.id === requester.userId) return true; // the student themself

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

  // docs/06 §6.3 — parents never get write access, so this is deliberately narrower than
  // hasReadAccess: no student-self, no guardian-link branch.
  private async hasWriteAccess(
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
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (!teacherProfile) return false;
    const assignment = await this.assignmentRepo.findOne({
      where: {
        student: { id: student.id },
        teacherProfile: { id: teacherProfile.id },
        assignedTo: IsNull(),
      },
    });
    return !!assignment;
  }

  private async assertWriteAccess(
    student: StudentProfile,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (!(await this.hasWriteAccess(student, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_STUDENT',
        message: 'You do not have write access to this student',
      });
    }
  }
}
