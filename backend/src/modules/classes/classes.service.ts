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
  FindOptionsWhere,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import { RRule } from 'rrule';
import { Class, ClassStatus } from './entities/class.entity';
import { ClassScheduleVersion } from './entities/class-schedule-version.entity';
import { ScheduleException } from './entities/schedule-exception.entity';
import {
  Enrollment,
  EnrollmentEntryStatus,
} from './entities/enrollment.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { AddToWaitlistDto } from './dto/add-to-waitlist.dto';
import {
  materializeOccurrences,
  occurrencesOverlap,
} from './utils/schedule-occurrences.util';

// docs/03 §3.5 conflict detection — a 14-day look-ahead is enough for "does this new schedule
// clash with something happening soon" without materializing occurrences indefinitely.
const CONFLICT_WINDOW_DAYS = 14;

export interface ConflictEntry {
  conflictingClassId: string;
  conflictingClassName: string;
  occurrenceDate: string; // ISO datetime of the conflicting occurrence
  type: 'teacher_double_booking' | 'location_conflict';
}

// Not one of docs/04 §4.4's originally-listed endpoints — added because a class's detail view
// is fairly hollow without knowing who's enrolled in it. Shaped explicitly (not the raw
// Enrollment entity) for the same reason as GuardianSummary in students.service.ts: the related
// StudentProfile shouldn't ride along wholesale into a response that only needs a name.
export interface EnrollmentSummary {
  id: string;
  studentId: string;
  studentFullName: string;
  status: string;
  enrolledFrom: string;
  enrolledTo: string | null;
}

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(ClassScheduleVersion)
    private readonly scheduleVersionRepo: Repository<ClassScheduleVersion>,
    @InjectRepository(ScheduleException)
    private readonly exceptionRepo: Repository<ScheduleException>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    private readonly teacherProfilesService: TeacherProfilesService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(requesterUserId: string, dto: CreateClassDto): Promise<Class> {
    const teacherProfile =
      await this.teacherProfilesService.findByUserId(requesterUserId);
    if (!teacherProfile) {
      throw new ForbiddenException({
        code: 'TEACHER_PROFILE_REQUIRED',
        message: 'Complete your teacher profile before creating classes',
      });
    }

    const cls = this.classRepo.create({
      institute: teacherProfile.institute ?? null,
      teacherProfile,
      name: dto.name,
      subjectOrActivity: dto.subjectOrActivity,
      classType: dto.classType,
      mode: dto.mode,
      locationOrMeetingLink: dto.locationOrMeetingLink,
      capacityMax: dto.capacityMax,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    return this.classRepo.save(cls);
  }

  async findAll(
    requester: AuthenticatedUser,
    filters: { status?: ClassStatus },
  ): Promise<Class[]> {
    if (
      requester.activeRole === 'super_admin' ||
      requester.activeRole === 'institute_admin'
    ) {
      const where: FindOptionsWhere<Class> = {};
      if (requester.activeRole === 'institute_admin') {
        if (!requester.instituteId) return [];
        where.institute = { id: requester.instituteId };
      }
      if (filters.status) where.status = filters.status;
      return this.classRepo.find({ where, order: { startDate: 'DESC' } });
    }

    // Teacher (default): own classes only (docs/06 §6.2 "F (own)"). Student/parent listing is
    // out of scope for this endpoint in this pass — same rationale as StudentsService.findAll.
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (!teacherProfile) return [];

    const where: FindOptionsWhere<Class> = {
      teacherProfile: { id: teacherProfile.id },
    };
    if (filters.status) where.status = filters.status;
    return this.classRepo.find({ where, order: { startDate: 'DESC' } });
  }

  async findById(id: string, requester: AuthenticatedUser): Promise<Class> {
    const cls = await this.getRawById(id);
    if (!(await this.hasReadAccess(cls, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_CLASS',
        message: 'You do not have access to this class',
      });
    }
    return cls;
  }

  async update(
    id: string,
    requester: AuthenticatedUser,
    dto: UpdateClassDto,
  ): Promise<Class> {
    const cls = await this.getRawById(id);
    await this.assertWriteAccess(cls, requester);

    Object.assign(cls, {
      name: dto.name ?? cls.name,
      subjectOrActivity: dto.subjectOrActivity ?? cls.subjectOrActivity,
      classType: dto.classType ?? cls.classType,
      mode: dto.mode ?? cls.mode,
      locationOrMeetingLink:
        dto.locationOrMeetingLink ?? cls.locationOrMeetingLink,
      capacityMax: dto.capacityMax ?? cls.capacityMax,
      startDate: dto.startDate ?? cls.startDate,
      endDate: dto.endDate ?? cls.endDate,
      status: dto.status ?? cls.status,
    });
    return this.classRepo.save(cls);
  }

  // docs/04 §4.4 POST /classes/:id/schedule. docs/01 §1.5 "teacher reschedules a recurring
  // class" — this never edits an existing version; it closes the current one and opens a new one.
  async createSchedule(
    classId: string,
    requester: AuthenticatedUser,
    dto: CreateScheduleDto,
  ): Promise<ClassScheduleVersion> {
    const cls = await this.getRawById(classId);
    await this.assertWriteAccess(cls, requester);

    try {
      RRule.parseString(dto.recurrenceRule);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_RECURRENCE_RULE',
        message: 'recurrenceRule is not a valid RFC 5545 rule',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(ClassScheduleVersion, {
        where: { class: { id: classId }, effectiveTo: IsNull() },
      });
      if (current) {
        const dayBefore = new Date(`${dto.effectiveFrom}T00:00:00.000Z`);
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        current.effectiveTo = dayBefore.toISOString().slice(0, 10);
        await manager.save(current);
      }

      const version = manager.create(ClassScheduleVersion, {
        class: cls,
        effectiveFrom: dto.effectiveFrom,
        recurrenceRule: dto.recurrenceRule,
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone: dto.timezone ?? 'UTC',
      });
      return manager.save(version);
    });
  }

  async createException(
    classId: string,
    requester: AuthenticatedUser,
    dto: CreateExceptionDto,
  ): Promise<ScheduleException> {
    const cls = await this.getRawById(classId);
    await this.assertWriteAccess(cls, requester);

    const exception = this.exceptionRepo.create({
      class: cls,
      occurrenceDate: dto.occurrenceDate,
      exceptionType: dto.exceptionType,
      newDate: dto.newDate,
      newStartTime: dto.newStartTime,
      newEndTime: dto.newEndTime,
      reason: dto.reason,
      createdBy: { id: requester.userId } as User,
    });
    return this.exceptionRepo.save(exception);
  }

  async enrollStudent(
    classId: string,
    requester: AuthenticatedUser,
    dto: EnrollStudentDto,
  ): Promise<EnrollmentSummary> {
    const cls = await this.getRawById(classId);
    await this.assertWriteAccess(cls, requester);

    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${dto.studentId} not found`,
      });
    }

    const existing = await this.enrollmentRepo.findOne({
      where: {
        student: { id: dto.studentId },
        class: { id: classId },
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_ENROLLED',
        message: 'This student is already enrolled in this class',
      });
    }

    if (cls.capacityMax != null) {
      const activeCount = await this.enrollmentRepo.count({
        where: {
          class: { id: classId },
          status: In([
            EnrollmentEntryStatus.ACTIVE,
            EnrollmentEntryStatus.TRIAL,
          ]),
        },
      });
      if (activeCount >= cls.capacityMax) {
        // docs/01 §1.3 "waitlist for full batches" — don't fail silently, point at the fix.
        throw new ConflictException({
          code: 'CLASS_AT_CAPACITY',
          message:
            'This class is at capacity — use POST /classes/:id/waitlist instead',
        });
      }
    }

    const enrollment = this.enrollmentRepo.create({
      student,
      class: cls,
      enrolledFrom: new Date().toISOString().slice(0, 10),
      status:
        dto.enrollmentType === 'trial'
          ? EnrollmentEntryStatus.TRIAL
          : EnrollmentEntryStatus.ACTIVE,
    });
    const saved = await this.enrollmentRepo.save(enrollment);
    // Shaped, not the raw entity — same reasoning as toGuardianSummary() in students.service.ts:
    // the response shouldn't carry the full embedded StudentProfile/Class the client didn't ask for.
    return this.toEnrollmentSummary(saved);
  }

  async addToWaitlist(
    classId: string,
    requester: AuthenticatedUser,
    dto: AddToWaitlistDto,
  ): Promise<WaitlistEntry> {
    const cls = await this.getRawById(classId);
    await this.assertWriteAccess(cls, requester);

    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${dto.studentId} not found`,
      });
    }

    const existing = await this.waitlistRepo.findOne({
      where: {
        class: { id: classId },
        student: { id: dto.studentId },
        convertedToEnrollment: IsNull(),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_WAITLISTED',
        message: 'This student is already on the waitlist for this class',
      });
    }

    const entry = this.waitlistRepo.create({ class: cls, student });
    return this.waitlistRepo.save(entry);
  }

  // Not in docs/04 §4.4's original endpoint list — see EnrollmentSummary above for why this
  // was added. Read access only (same rule as findById).
  async getEnrollments(
    classId: string,
    requester: AuthenticatedUser,
  ): Promise<EnrollmentSummary[]> {
    const cls = await this.getRawById(classId);
    if (!(await this.hasReadAccess(cls, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_CLASS',
        message: 'You do not have access to this class',
      });
    }

    const enrollments = await this.enrollmentRepo.find({
      where: { class: { id: classId } },
      relations: { student: true },
      order: { enrolledFrom: 'DESC' },
    });
    return enrollments.map((enrollment) =>
      this.toEnrollmentSummary(enrollment),
    );
  }

  private toEnrollmentSummary(enrollment: Enrollment): EnrollmentSummary {
    return {
      id: enrollment.id,
      studentId: enrollment.student.id,
      studentFullName: enrollment.student.fullName,
      status: enrollment.status,
      enrolledFrom: enrollment.enrolledFrom,
      enrolledTo: enrollment.enrolledTo ?? null,
    };
  }

  // Also not in docs/04 §4.4's original list, added alongside getEnrollments for the same
  // "detail view needs this" reason — the mobile class detail screen shows the current schedule.
  async getCurrentSchedule(
    classId: string,
    requester: AuthenticatedUser,
  ): Promise<ClassScheduleVersion | null> {
    const cls = await this.getRawById(classId);
    if (!(await this.hasReadAccess(cls, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_CLASS',
        message: 'You do not have access to this class',
      });
    }
    return this.getCurrentScheduleVersion(classId);
  }

  // docs/03 §3.5, docs/08 §8.5 "live inline warning... non-blocking, shown before Save" — the
  // caller (mobile) polls this while the teacher is picking a schedule; it never blocks the
  // write itself (docs/01 §1.5: "flagged as a warning, not a hard block").
  async getConflicts(
    classId: string,
    requester: AuthenticatedUser,
  ): Promise<ConflictEntry[]> {
    const cls = await this.getRawById(classId);
    await this.assertWriteAccess(cls, requester);

    const currentVersion = await this.getCurrentScheduleVersion(classId);
    if (!currentVersion) return [];

    const windowStart = new Date();
    windowStart.setUTCHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + CONFLICT_WINDOW_DAYS);
    windowEnd.setUTCHours(23, 59, 59, 999);

    const targetOccurrences = materializeOccurrences(
      currentVersion,
      windowStart,
      windowEnd,
    );
    if (targetOccurrences.length === 0) return [];

    const conflicts: ConflictEntry[] = [];

    // Teacher double-booking: other active classes taught by the same teacher.
    const teacherClasses = await this.classRepo.find({
      where: {
        teacherProfile: { id: cls.teacherProfile.id },
        id: Not(classId),
        status: Not(ClassStatus.CANCELLED),
      },
    });
    for (const other of teacherClasses) {
      const otherVersion = await this.getCurrentScheduleVersion(other.id);
      if (!otherVersion) continue;
      const otherOccurrences = materializeOccurrences(
        otherVersion,
        windowStart,
        windowEnd,
      );
      this.collectOverlaps(
        targetOccurrences,
        otherOccurrences,
        other,
        'teacher_double_booking',
        conflicts,
      );
    }

    // Location conflict: other active classes at the same institute sharing the exact same
    // location/meeting-link string (docs/01 §1.5 "a room/location is already booked"). Skipped
    // for independent teachers (no institute) or when no location is set.
    // TODO(docs/06 §6.2): student-schedule overlap ("a student is assigned overlapping classes")
    // isn't checked here — it needs cross-referencing every enrolled student's other active
    // enrollments, which is a heavier query left for a follow-up pass.
    if (cls.institute?.id && cls.locationOrMeetingLink) {
      const locationClasses = await this.classRepo.find({
        where: {
          institute: { id: cls.institute.id },
          locationOrMeetingLink: cls.locationOrMeetingLink,
          id: Not(classId),
          status: Not(ClassStatus.CANCELLED),
        },
        relations: { teacherProfile: true },
      });
      for (const other of locationClasses) {
        if (other.teacherProfile?.id === cls.teacherProfile.id) continue; // already reported above
        const otherVersion = await this.getCurrentScheduleVersion(other.id);
        if (!otherVersion) continue;
        const otherOccurrences = materializeOccurrences(
          otherVersion,
          windowStart,
          windowEnd,
        );
        this.collectOverlaps(
          targetOccurrences,
          otherOccurrences,
          other,
          'location_conflict',
          conflicts,
        );
      }
    }

    return conflicts;
  }

  private collectOverlaps(
    targetOccurrences: ReturnType<typeof materializeOccurrences>,
    otherOccurrences: ReturnType<typeof materializeOccurrences>,
    otherClass: Class,
    type: ConflictEntry['type'],
    out: ConflictEntry[],
  ): void {
    for (const occurrence of targetOccurrences) {
      for (const otherOccurrence of otherOccurrences) {
        if (occurrencesOverlap(occurrence, otherOccurrence)) {
          out.push({
            conflictingClassId: otherClass.id,
            conflictingClassName: otherClass.name,
            occurrenceDate: occurrence.start.toISOString(),
            type,
          });
        }
      }
    }
  }

  private async getCurrentScheduleVersion(
    classId: string,
  ): Promise<ClassScheduleVersion | null> {
    return this.scheduleVersionRepo.findOne({
      where: { class: { id: classId }, effectiveTo: IsNull() },
      order: { effectiveFrom: 'DESC' },
    });
  }

  private async getRawById(id: string): Promise<Class> {
    const cls = await this.classRepo.findOne({
      where: { id },
      relations: { teacherProfile: true, institute: true },
    });
    if (!cls) {
      throw new NotFoundException({
        code: 'CLASS_NOT_FOUND',
        message: `Class ${id} not found`,
      });
    }
    return cls;
  }

  private async hasWriteAccess(
    cls: Class,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (requester.activeRole === 'super_admin') return true;
    if (
      requester.activeRole === 'institute_admin' &&
      cls.institute?.id &&
      cls.institute.id === requester.instituteId
    ) {
      return true;
    }
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    return !!teacherProfile && teacherProfile.id === cls.teacherProfile.id;
  }

  private async assertWriteAccess(
    cls: Class,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (!(await this.hasWriteAccess(cls, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_CLASS',
        message: 'You do not have write access to this class',
      });
    }
  }

  // docs/06 §6.2 — parent read access via guardian link isn't checked yet (needs a join through
  // student_guardian_links, same cross-module shape as the TODOs in students.service.ts); a
  // student's own enrollment is.
  private async hasReadAccess(
    cls: Class,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (await this.hasWriteAccess(cls, requester)) return true;
    const enrollment = await this.enrollmentRepo.findOne({
      where: {
        class: { id: cls.id },
        student: { user: { id: requester.userId } },
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
    });
    return !!enrollment;
  }
}
