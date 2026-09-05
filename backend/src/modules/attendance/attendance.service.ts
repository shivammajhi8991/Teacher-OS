import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  AttendanceSession,
  AttendanceSessionStatus,
  MarkingMethod,
} from './entities/attendance-session.entity';
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
import {
  Enrollment,
  EnrollmentEntryStatus,
} from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';

export interface RosterEntry {
  studentId: string;
  studentFullName: string;
  status: AttendanceStatus | null; // null = not yet marked
}

export interface AttendanceRosterResult {
  classId: string;
  occurrenceDate: string;
  sessionId: string | null;
  isCancelled: boolean;
  cancellationReason: string | null;
  students: RosterEntry[];
}

export interface BulkMarkResult extends AttendanceRosterResult {
  skippedStudentIds: string[]; // submitted, but not actively enrolled as of occurrenceDate
}

export interface AttendanceRecordSummary {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
  markedAt: Date;
}

export interface StudentAttendanceEntry {
  id: string;
  classId: string;
  className: string;
  occurrenceDate: string;
  status: AttendanceStatus;
}

export interface StudentAttendanceResult {
  studentId: string;
  percentage: number | null; // (present+late) / applicable, excluding holiday/cancelled
  records: StudentAttendanceEntry[];
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(AttendanceAuditLog)
    private readonly auditLogRepo: Repository<AttendanceAuditLog>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Institute)
    private readonly instituteRepo: Repository<Institute>,
    @InjectRepository(ScheduleException)
    private readonly exceptionRepo: Repository<ScheduleException>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    @InjectRepository(StudentTeacherAssignment)
    private readonly assignmentRepo: Repository<StudentTeacherAssignment>,
    private readonly teacherProfilesService: TeacherProfilesService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getRoster(
    classId: string,
    occurrenceDate: string,
    requester: AuthenticatedUser,
  ): Promise<AttendanceRosterResult> {
    const cls = await this.getClassOrThrow(classId);
    await this.assertMarkAccess(cls, requester);

    const blocking = await this.findBlockingException(classId, occurrenceDate);
    const activeEnrollments = await this.getActiveEnrollments(
      classId,
      occurrenceDate,
    );

    const session = await this.sessionRepo.findOne({
      where: { class: { id: classId }, occurrenceDate },
    });
    const existingRecords = session
      ? await this.recordRepo.find({
          where: { attendanceSession: { id: session.id } },
          relations: { student: true },
        })
      : [];
    const statusByStudent = new Map(
      existingRecords.map((r) => [r.student.id, r.status]),
    );

    return {
      classId,
      occurrenceDate,
      sessionId: session?.id ?? null,
      isCancelled: !!blocking,
      cancellationReason: blocking
        ? (blocking.reason ?? blocking.exceptionType)
        : null,
      students: activeEnrollments.map((enrollment) => ({
        studentId: enrollment.student.id,
        studentFullName: enrollment.student.fullName,
        status: statusByStudent.get(enrollment.student.id) ?? null,
      })),
    };
  }

  // docs/04 §4.4 POST .../bulk, docs/08 §8.3 Quick Attendance's Save. Upsert-by-(session,student)
  // makes this naturally idempotent (see attendance-record.entity.ts) — replaying the same call
  // after a dropped connection converges to the same end state, which is exactly what the
  // mobile offline-sync queue (core/sync) depends on.
  async bulkMark(
    classId: string,
    occurrenceDate: string,
    requester: AuthenticatedUser,
    dto: BulkMarkAttendanceDto,
  ): Promise<BulkMarkResult> {
    const cls = await this.getClassOrThrow(classId);
    await this.assertMarkAccess(cls, requester);

    const blocking = await this.findBlockingException(classId, occurrenceDate);
    if (blocking) {
      throw new BadRequestException({
        code: 'OCCURRENCE_CANCELLED',
        message: `This occurrence is marked '${blocking.exceptionType}' — attendance can't be recorded for it`,
      });
    }

    const activeEnrollments = await this.getActiveEnrollments(
      classId,
      occurrenceDate,
    );
    const activeStudentIds = new Set(
      activeEnrollments.map((e) => e.student.id),
    );
    const validRecords = dto.records.filter((r) =>
      activeStudentIds.has(r.studentId),
    );
    const skippedStudentIds = dto.records
      .filter((r) => !activeStudentIds.has(r.studentId))
      .map((r) => r.studentId);

    await this.dataSource.transaction(async (manager) => {
      let session = await manager.findOne(AttendanceSession, {
        where: { class: { id: classId }, occurrenceDate },
      });
      if (!session) {
        session = manager.create(AttendanceSession, {
          class: cls,
          occurrenceDate,
        });
      }
      session.status = AttendanceSessionStatus.HELD;
      session.markedBy = { id: requester.userId } as User;
      session.markedAt = new Date();
      session.markingMethod = MarkingMethod.BULK;
      await manager.save(session);

      for (const input of validRecords) {
        const existing = await manager.findOne(AttendanceRecord, {
          where: {
            attendanceSession: { id: session.id },
            student: { id: input.studentId },
          },
        });

        if (existing) {
          if (existing.status === input.status) continue; // idempotent re-submission — no-op
          await manager.save(
            manager.create(AttendanceAuditLog, {
              attendanceRecord: existing,
              previousStatus: existing.status,
              newStatus: input.status,
              changedBy: { id: requester.userId } as User,
              reason: 'Re-marked via bulk attendance',
            }),
          );
          existing.status = input.status;
          existing.notes = input.notes ?? existing.notes;
          existing.markedAt = new Date();
          existing.markedBy = { id: requester.userId } as User;
          await manager.save(existing);
        } else {
          await manager.save(
            manager.create(AttendanceRecord, {
              attendanceSession: session,
              student: { id: input.studentId } as StudentProfile,
              status: input.status,
              notes: input.notes,
              markedAt: new Date(),
              markedBy: { id: requester.userId } as User,
            }),
          );
        }
      }
    });

    const roster = await this.getRoster(classId, occurrenceDate, requester);
    return { ...roster, skippedStudentIds };
  }

  async updateRecord(
    recordId: string,
    requester: AuthenticatedUser,
    dto: UpdateAttendanceRecordDto,
  ): Promise<AttendanceRecordSummary> {
    const record = await this.recordRepo.findOne({
      where: { id: recordId },
      relations: {
        attendanceSession: { class: { teacherProfile: true, institute: true } },
        student: true,
      },
    });
    if (!record) {
      throw new NotFoundException({
        code: 'ATTENDANCE_RECORD_NOT_FOUND',
        message: `Attendance record ${recordId} not found`,
      });
    }

    await this.assertMarkAccess(record.attendanceSession.class, requester);

    if (record.invoiced) {
      // docs/01 §1.5 — never mutate billed history in place; the Fees module (docs/07 step 6)
      // will add a proper adjustment path.
      throw new ConflictException({
        code: 'ATTENDANCE_ALREADY_INVOICED',
        message:
          'This record has already been invoiced — recalculation needs a fee adjustment, ' +
          'not a direct attendance edit',
      });
    }

    if (dto.status !== record.status) {
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          attendanceRecord: record,
          previousStatus: record.status,
          newStatus: dto.status,
          changedBy: { id: requester.userId } as User,
          reason: dto.reason,
        }),
      );
      record.status = dto.status;
    }
    record.notes = dto.notes ?? record.notes;
    record.markedAt = new Date();
    record.markedBy = { id: requester.userId } as User;
    const saved = await this.recordRepo.save(record);

    return {
      id: saved.id,
      studentId: record.student.id,
      status: saved.status,
      notes: saved.notes,
      markedAt: saved.markedAt,
    };
  }

  async getStudentAttendance(
    studentId: string,
    requester: AuthenticatedUser,
    range: { from?: string; to?: string },
  ): Promise<StudentAttendanceResult> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: { user: true, institute: true },
      select: {
        id: true,
        fullName: true,
        user: { id: true },
        institute: { id: true },
      },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${studentId} not found`,
      });
    }
    if (!(await this.hasStudentAttendanceReadAccess(student, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_ATTENDANCE',
        message: "You do not have access to this student's attendance",
      });
    }

    const where: FindOptionsWhere<AttendanceRecord> = {
      student: { id: studentId },
    };
    if (range.from && range.to) {
      where.attendanceSession = {
        occurrenceDate: Between(range.from, range.to),
      };
    } else if (range.from) {
      where.attendanceSession = { occurrenceDate: MoreThanOrEqual(range.from) };
    } else if (range.to) {
      where.attendanceSession = { occurrenceDate: LessThanOrEqual(range.to) };
    }

    const records = await this.recordRepo.find({
      where,
      relations: { attendanceSession: { class: true } },
      order: { markedAt: 'DESC' },
    });

    const applicable = records.filter(
      (r) =>
        r.status !== AttendanceStatus.HOLIDAY &&
        r.status !== AttendanceStatus.CANCELLED,
    );
    const presentEquivalent = applicable.filter(
      (r) =>
        r.status === AttendanceStatus.PRESENT ||
        r.status === AttendanceStatus.LATE,
    ).length;
    const percentage = applicable.length
      ? Math.round((presentEquivalent / applicable.length) * 10000) / 100
      : null;

    return {
      studentId,
      percentage,
      records: records.map((r) => ({
        id: r.id,
        classId: r.attendanceSession.class.id,
        className: r.attendanceSession.class.name,
        occurrenceDate: r.attendanceSession.occurrenceDate,
        status: r.status,
      })),
    };
  }

  private async getActiveEnrollments(
    classId: string,
    occurrenceDate: string,
  ): Promise<Enrollment[]> {
    const enrollments = await this.enrollmentRepo.find({
      where: {
        class: { id: classId },
        enrolledFrom: LessThanOrEqual(occurrenceDate),
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
      relations: { student: true },
      order: { student: { fullName: 'ASC' } },
    });
    // `enrolledTo IS NULL OR enrolledTo >= occurrenceDate` — simpler to filter in JS than to
    // express the OR in a single TypeORM where object; roster sizes make this a non-issue.
    return enrollments.filter(
      (e) => !e.enrolledTo || e.enrolledTo >= occurrenceDate,
    );
  }

  private async findBlockingException(
    classId: string,
    occurrenceDate: string,
  ): Promise<ScheduleException | null> {
    return this.exceptionRepo.findOne({
      where: {
        class: { id: classId },
        occurrenceDate,
        exceptionType: In([
          ScheduleExceptionType.HOLIDAY,
          ScheduleExceptionType.CANCELLED,
        ]),
      },
    });
  }

  private async getClassOrThrow(classId: string): Promise<Class> {
    const cls = await this.classRepo.findOne({
      where: { id: classId },
      relations: { teacherProfile: true, institute: true },
    });
    if (!cls) {
      throw new NotFoundException({
        code: 'CLASS_NOT_FOUND',
        message: `Class ${classId} not found`,
      });
    }
    return cls;
  }

  // docs/06 §6.3 — attendance marking is teacher-only by default; an institute_admin can only
  // mark/edit if their institute has explicitly opted into `allowAdminAttendanceOverride`
  // (toggling that flag is itself an audit-logged admin action, per institute.entity.ts).
  private async hasMarkAccess(
    cls: Class,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (requester.activeRole === 'super_admin') return true;
    if (requester.activeRole === 'institute_admin') {
      if (!cls.institute?.id || cls.institute.id !== requester.instituteId)
        return false;
      const institute = await this.instituteRepo.findOne({
        where: { id: cls.institute.id },
      });
      return !!institute?.allowAdminAttendanceOverride;
    }
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    return !!teacherProfile && teacherProfile.id === cls.teacherProfile.id;
  }

  private async assertMarkAccess(
    cls: Class,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (!(await this.hasMarkAccess(cls, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_ATTENDANCE',
        message: 'You do not have permission to mark attendance for this class',
      });
    }
  }

  // Mirrors StudentsService.hasReadAccess (docs/06 §6.2: teacher-of-this-student / self / linked
  // guardian / institute_admin / super_admin) — duplicated rather than shared across modules, same
  // as ClassesService's equivalent, since each module owns its own resource-scoping rules.
  private async hasStudentAttendanceReadAccess(
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
}
