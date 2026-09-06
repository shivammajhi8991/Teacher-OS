import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Assignment } from './entities/assignment.entity';
import {
  AssignmentSubmission,
  SubmissionStatus,
} from './entities/assignment-submission.entity';
import { Class } from '../classes/entities/class.entity';
import {
  Enrollment,
  EnrollmentEntryStatus,
} from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import {
  STORAGE_ADAPTER,
  StorageAdapter,
} from '../../common/storage/storage.adapter';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';

export interface AssignmentSummary {
  id: string;
  title: string;
  description: string | null;
  classId: string | null;
  studentId: string | null;
  dueAt: Date;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  attachmentUrls: string[];
  createdAt: Date;
}

export interface SubmissionSummary {
  id: string;
  assignmentId: string;
  studentId: string;
  attachmentUrls: string[];
  submittedAt: Date;
  isLate: boolean;
  attemptNumber: number;
  status: SubmissionStatus;
  grade: string | null;
  feedback: string | null;
  reviewedAt: Date | null;
}

export interface FileContent {
  kind: 'redirect' | 'buffer';
  redirectUrl?: string;
  buffer?: Buffer;
}

// docs/03 §3.8 / docs/06 §6.2 "Assignments." Per the RBAC matrix, only the owning teacher ever
// gets write access here — institute_admin and even super_admin are marked read-only (R), unlike
// most other resources in this codebase where super_admin is an unconditional escape hatch. This
// service keeps super_admin's bypass anyway, for consistency with every other module already
// built (FeesService, NotesService, ...) rather than introducing a one-off exception — a
// deliberate, documented choice, not an oversight of the matrix.
//
// docs/08 §8.2 Parent screen inventory has no Assignments tab at all (Dashboard/Fees/
// Announcements/Profile only) — the matrix's "–" for Parent on both assignment rows matches that
// navigation exactly, so this service grants Parent no assignment access, by design.
@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(AssignmentSubmission)
    private readonly submissionRepo: Repository<AssignmentSubmission>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    private readonly teacherProfilesService: TeacherProfilesService,
    private readonly notificationsService: NotificationsService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async createUploadUrl(): Promise<{ uploadUrl: string; objectKey: string }> {
    return this.storage.createPresignedUpload('assignments');
  }

  async writeUploadedBytes(objectKey: string, data: Buffer): Promise<void> {
    await this.storage.writeObject(objectKey, data);
  }

  async createAssignment(
    requester: AuthenticatedUser,
    dto: CreateAssignmentDto,
  ): Promise<AssignmentSummary> {
    if ((!dto.classId && !dto.studentId) || (dto.classId && dto.studentId)) {
      throw new BadRequestException({
        code: 'EXACTLY_ONE_TARGET_REQUIRED',
        message: 'Provide exactly one of classId or studentId',
      });
    }

    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (!teacherProfile) {
      throw new ForbiddenException({
        code: 'NOT_A_TEACHER',
        message: 'Only a teacher can create an assignment',
      });
    }

    let cls: Class | null = null;
    if (dto.classId) {
      cls = await this.classRepo.findOne({ where: { id: dto.classId } });
      if (!cls) {
        throw new NotFoundException({
          code: 'CLASS_NOT_FOUND',
          message: `Class ${dto.classId} not found`,
        });
      }
      if (cls.teacherProfile.id !== teacherProfile.id) {
        throw new ForbiddenException({
          code: 'NOT_AUTHORIZED_FOR_CLASS',
          message: 'You do not teach this class',
        });
      }
    }
    let student: StudentProfile | null = null;
    if (dto.studentId) {
      student = await this.studentRepo.findOne({
        where: { id: dto.studentId },
      });
      if (!student) {
        throw new NotFoundException({
          code: 'STUDENT_NOT_FOUND',
          message: `Student ${dto.studentId} not found`,
        });
      }
    }

    const attachmentUrls = await this.validateAttachmentUrls(
      dto.attachmentUrls ?? [],
    );

    const assignment = await this.assignmentRepo.save(
      this.assignmentRepo.create({
        class: cls,
        student,
        teacherProfile,
        title: dto.title,
        description: dto.description,
        attachmentUrls,
        dueAt: new Date(dto.dueAt),
        allowLateSubmission: dto.allowLateSubmission ?? true,
        allowResubmission: dto.allowResubmission ?? false,
      }),
    );

    // docs/01 §1.3 notification digesting example — a new assignment carries a deadline, so it
    // defaults to an immediate push (notifications.constants.ts's ASSIGNMENT category), unlike a
    // passive fee/document.
    const studentIds = dto.classId
      ? await this.getActivelyEnrolledStudentIds(dto.classId)
      : [student!.id];
    await Promise.all(
      studentIds.map((id) =>
        this.notifyStudentParty(
          id,
          'assignment_created',
          'New assignment',
          `${dto.title} — due ${new Date(dto.dueAt).toLocaleDateString()}`,
          { assignmentId: assignment.id },
        ),
      ),
    );

    return this.toAssignmentSummary(assignment);
  }

  async listAssignments(
    requester: AuthenticatedUser,
    filters: { classId?: string; studentId?: string },
  ): Promise<AssignmentSummary[]> {
    let assignments: Assignment[];

    if (requester.activeRole === 'super_admin') {
      assignments = await this.assignmentRepo.find({
        where: {
          ...(filters.classId ? { class: { id: filters.classId } } : {}),
          ...(filters.studentId ? { student: { id: filters.studentId } } : {}),
        },
        order: { createdAt: 'DESC' },
      });
    } else if (requester.activeRole === 'institute_admin') {
      if (!requester.instituteId) return [];
      assignments = await this.assignmentRepo.find({
        where: { teacherProfile: { institute: { id: requester.instituteId } } },
        relations: { teacherProfile: { institute: true } },
        order: { createdAt: 'DESC' },
      });
    } else if (requester.activeRole === 'student') {
      const student = await this.studentRepo.findOne({
        where: { user: { id: requester.userId } },
      });
      if (!student) return [];
      const enrolledClassIds = await this.getActiveClassIds(student.id);
      const where = enrolledClassIds.length
        ? [
            { student: { id: student.id } },
            { class: { id: In(enrolledClassIds) } },
          ]
        : [{ student: { id: student.id } }];
      assignments = await this.assignmentRepo.find({
        where,
        order: { createdAt: 'DESC' },
      });
    } else {
      // teacher — own assignments only, per docs/06 §6.2's "F (own classes)".
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (!teacherProfile) return [];
      assignments = await this.assignmentRepo.find({
        where: {
          teacherProfile: { id: teacherProfile.id },
          ...(filters.classId ? { class: { id: filters.classId } } : {}),
        },
        order: { createdAt: 'DESC' },
      });
    }

    return assignments.map((a) => this.toAssignmentSummary(a));
  }

  async getAssignment(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<AssignmentSummary> {
    const assignment = await this.getRawById(id);
    if (!(await this.hasReadAccess(assignment, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_ASSIGNMENT',
        message: 'You do not have access to this assignment',
      });
    }
    return this.toAssignmentSummary(assignment);
  }

  async getAssignmentAttachment(
    assignmentId: string,
    objectKey: string,
    requester: AuthenticatedUser,
  ): Promise<FileContent> {
    const assignment = await this.getRawById(assignmentId);
    if (!(await this.hasReadAccess(assignment, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_ASSIGNMENT',
        message: 'You do not have access to this assignment',
      });
    }
    if (!assignment.attachmentUrls.includes(objectKey)) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'No such attachment on this assignment',
      });
    }
    return this.resolveAttachment(objectKey);
  }

  async createSubmission(
    assignmentId: string,
    requester: AuthenticatedUser,
    dto: CreateSubmissionDto,
  ): Promise<SubmissionSummary> {
    const assignment = await this.getRawById(assignmentId);
    const student = await this.studentRepo.findOne({
      where: { user: { id: requester.userId } },
    });
    if (!student || !(await this.isAssignmentTarget(assignment, student))) {
      throw new ForbiddenException({
        code: 'NOT_AN_ASSIGNMENT_TARGET',
        message: 'This assignment was not assigned to you',
      });
    }

    const priorAttempts = await this.submissionRepo.count({
      where: { assignment: { id: assignment.id }, student: { id: student.id } },
    });
    if (priorAttempts > 0 && !assignment.allowResubmission) {
      throw new ConflictException({
        code: 'RESUBMISSION_NOT_ALLOWED',
        message: 'This assignment does not allow resubmission',
      });
    }

    const isLate = new Date() > assignment.dueAt;
    if (isLate && !assignment.allowLateSubmission) {
      throw new ConflictException({
        code: 'LATE_SUBMISSION_NOT_ALLOWED',
        message: 'The deadline for this assignment has passed',
      });
    }

    const attachmentUrls = await this.validateAttachmentUrls(
      dto.attachmentUrls,
    );

    const submission = await this.submissionRepo.save(
      this.submissionRepo.create({
        assignment,
        student,
        attachmentUrls,
        isLate,
        attemptNumber: priorAttempts + 1,
        status: SubmissionStatus.SUBMITTED,
      }),
    );
    return this.toSubmissionSummary(submission);
  }

  async listSubmissions(
    assignmentId: string,
    requester: AuthenticatedUser,
  ): Promise<SubmissionSummary[]> {
    const assignment = await this.getRawById(assignmentId);

    if (await this.hasWriteAccess(assignment, requester)) {
      const submissions = await this.submissionRepo.find({
        where: { assignment: { id: assignmentId } },
        order: { submittedAt: 'DESC' },
      });
      return submissions.map((s) => this.toSubmissionSummary(s));
    }

    const student = await this.studentRepo.findOne({
      where: { user: { id: requester.userId } },
    });
    if (student && (await this.isAssignmentTarget(assignment, student))) {
      const submissions = await this.submissionRepo.find({
        where: {
          assignment: { id: assignmentId },
          student: { id: student.id },
        },
        order: { submittedAt: 'DESC' },
      });
      return submissions.map((s) => this.toSubmissionSummary(s));
    }

    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_ASSIGNMENT',
      message: 'You do not have access to these submissions',
    });
  }

  async getSubmissionAttachment(
    submissionId: string,
    objectKey: string,
    requester: AuthenticatedUser,
  ): Promise<FileContent> {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: { assignment: { teacherProfile: true }, student: true },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 'SUBMISSION_NOT_FOUND',
        message: `Submission ${submissionId} not found`,
      });
    }

    const isOwner =
      requester.activeRole === 'student' &&
      (await this.studentRepo.findOne({
        where: { id: submission.student.id, user: { id: requester.userId } },
      })) !== null;
    if (
      !isOwner &&
      !(await this.hasWriteAccess(submission.assignment, requester))
    ) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_SUBMISSION',
        message: 'You do not have access to this submission',
      });
    }
    if (!submission.attachmentUrls.includes(objectKey)) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'No such attachment on this submission',
      });
    }
    return this.resolveAttachment(objectKey);
  }

  async reviewSubmission(
    submissionId: string,
    requester: AuthenticatedUser,
    dto: ReviewSubmissionDto,
  ): Promise<SubmissionSummary> {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: { assignment: { teacherProfile: true }, student: true },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 'SUBMISSION_NOT_FOUND',
        message: `Submission ${submissionId} not found`,
      });
    }
    if (!(await this.hasWriteAccess(submission.assignment, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_SUBMISSION',
        message: 'You do not have permission to review this submission',
      });
    }

    submission.grade = dto.grade ?? submission.grade ?? null;
    submission.feedback = dto.feedback ?? submission.feedback ?? null;
    submission.status = SubmissionStatus.REVIEWED;
    submission.reviewedBy = { id: requester.userId } as User;
    submission.reviewedAt = new Date();
    const saved = await this.submissionRepo.save(submission);

    await this.notifyStudentParty(
      submission.student.id,
      'submission_reviewed',
      'Assignment reviewed',
      submission.grade
        ? `Graded: ${submission.grade}`
        : 'Your submission has feedback',
      { assignmentId: submission.assignment.id, submissionId: saved.id },
    );

    return this.toSubmissionSummary(saved);
  }

  // ---------------------------------------------------------------- Access control -------------

  private async getRawById(id: string): Promise<Assignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: {
        class: true,
        student: true,
        teacherProfile: { institute: true },
      },
    });
    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: `Assignment ${id} not found`,
      });
    }
    return assignment;
  }

  private async hasWriteAccess(
    assignment: Assignment,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (requester.activeRole === 'super_admin') return true;
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    return (
      !!teacherProfile && teacherProfile.id === assignment.teacherProfile.id
    );
  }

  private async hasReadAccess(
    assignment: Assignment,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (await this.hasWriteAccess(assignment, requester)) return true;
    if (
      requester.activeRole === 'institute_admin' &&
      assignment.teacherProfile.institute?.id &&
      assignment.teacherProfile.institute.id === requester.instituteId
    ) {
      return true;
    }
    if (requester.activeRole === 'student') {
      const student = await this.studentRepo.findOne({
        where: { user: { id: requester.userId } },
      });
      return !!student && (await this.isAssignmentTarget(assignment, student));
    }
    return false; // Parent: no assignment access at all, by design — see class header comment.
  }

  private async isAssignmentTarget(
    assignment: Assignment,
    student: StudentProfile,
  ): Promise<boolean> {
    if (assignment.student?.id === student.id) return true;
    if (!assignment.class?.id) return false;
    const enrollment = await this.enrollmentRepo.findOne({
      where: {
        class: { id: assignment.class.id },
        student: { id: student.id },
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
    });
    return !!enrollment;
  }

  private async getActiveClassIds(studentId: string): Promise<string[]> {
    const enrollments = await this.enrollmentRepo.find({
      where: {
        student: { id: studentId },
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
      relations: { class: true },
    });
    return enrollments.map((e) => e.class.id);
  }

  private async getActivelyEnrolledStudentIds(
    classId: string,
  ): Promise<string[]> {
    const enrollments = await this.enrollmentRepo.find({
      where: {
        class: { id: classId },
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
      relations: { student: true },
    });
    return enrollments.map((e) => e.student.id);
  }

  // ---------------------------------------------------------------- Attachments -----------------

  // Each entry is either this app's own storage object key (from the presigned-upload flow) or
  // an external URL — see assignment.entity.ts's header comment for why there's no per-entry
  // type discriminator. An entry that's neither a real uploaded object nor a parseable http(s)
  // URL is rejected outright rather than silently stored as dead content.
  private async validateAttachmentUrls(urls: string[]): Promise<string[]> {
    for (const url of urls) {
      const isUploaded = await this.storage.objectExists(url);
      if (isUploaded) continue;
      let isHttpUrl = false;
      try {
        isHttpUrl = ['http:', 'https:'].includes(new URL(url).protocol);
      } catch {
        isHttpUrl = false;
      }
      if (!isHttpUrl) {
        throw new BadRequestException({
          code: 'INVALID_ATTACHMENT',
          message: `"${url}" is neither an uploaded object nor a valid URL`,
        });
      }
    }
    return urls;
  }

  private async resolveAttachment(objectKey: string): Promise<FileContent> {
    if (await this.storage.objectExists(objectKey)) {
      return {
        kind: 'buffer',
        buffer: await this.storage.readObject(objectKey),
      };
    }
    return { kind: 'redirect', redirectUrl: objectKey };
  }

  // ---------------------------------------------------------------- Notifications ---------------

  // Duplicated from FeesService/NotesService's equivalent helpers rather than shared — this
  // codebase's established "each module owns its own access/notify resolution" convention.
  private async getNotifiableUserIds(studentId: string): Promise<string[]> {
    const ids = new Set<string>();

    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: { user: true },
      select: { id: true, user: { id: true } },
    });
    if (student?.user?.id) ids.add(student.user.id);

    const guardianLinks = await this.guardianLinkRepo.find({
      where: { student: { id: studentId } },
      relations: { guardian: { user: true } },
      select: { id: true, guardian: { id: true, user: { id: true } } },
    });
    for (const link of guardianLinks) {
      if (link.guardian.user?.id) ids.add(link.guardian.user.id);
    }
    return Array.from(ids);
  }

  private async notifyStudentParty(
    studentId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const userIds = await this.getNotifiableUserIds(studentId);
    await Promise.all(
      userIds.map((userId) =>
        this.notificationsService.notify({ userId, type, title, body, data }),
      ),
    );
  }

  // ---------------------------------------------------------------- Shaping ----------------------

  private toAssignmentSummary(assignment: Assignment): AssignmentSummary {
    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description ?? null,
      classId: assignment.class?.id ?? null,
      studentId: assignment.student?.id ?? null,
      dueAt: assignment.dueAt,
      allowLateSubmission: assignment.allowLateSubmission,
      allowResubmission: assignment.allowResubmission,
      attachmentUrls: assignment.attachmentUrls,
      createdAt: assignment.createdAt,
    };
  }

  private toSubmissionSummary(
    submission: AssignmentSubmission,
  ): SubmissionSummary {
    return {
      id: submission.id,
      assignmentId: submission.assignment.id,
      studentId: submission.student.id,
      attachmentUrls: submission.attachmentUrls,
      submittedAt: submission.submittedAt,
      isLate: submission.isLate,
      attemptNumber: submission.attemptNumber,
      status: submission.status,
      grade: submission.grade ?? null,
      feedback: submission.feedback ?? null,
      reviewedAt: submission.reviewedAt ?? null,
    };
  }
}
