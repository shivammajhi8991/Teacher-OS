import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { Class, ClassStatus } from '../classes/entities/class.entity';
import { ClassScheduleVersion } from '../classes/entities/class-schedule-version.entity';
import {
  Enrollment,
  EnrollmentEntryStatus,
} from '../classes/entities/enrollment.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Invoice } from '../fees/entities/invoice.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import {
  materializeOccurrences,
  occurrencesOverlap,
} from '../classes/utils/schedule-occurrences.util';

export type CalendarEventType =
  'class_occurrence' | 'assignment_due' | 'fee_due';
export type ConflictReason = 'teacher_double_booking' | 'location_conflict';

export interface CalendarEvent {
  id: string;
  eventType: CalendarEventType;
  sourceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  conflict: boolean;
  conflictReason?: ConflictReason;
}

interface ClassOccurrenceMeta {
  classId: string;
  teacherProfileId: string;
  instituteId: string | null;
  locationOrMeetingLink: string | null;
}

type Scope =
  | { kind: 'teacher'; teacherProfileId: string }
  | { kind: 'students'; studentProfileIds: string[] }
  | { kind: 'class'; classId: string }
  | { kind: 'institute'; instituteId?: string }; // undefined instituteId = platform-wide (super_admin)

// docs/03 §3.5's own `calendar_events` sketch describes a persisted table unifying classes,
// assignments, and fee due dates. Implemented instead as a live-computed aggregation over the
// real source tables (Classes, Assignments, Fees) — matching how every other "unified view" in
// this codebase works (Attendance history's percentage, Fees' revenue summary, Reports): a
// persisted, denormalized table would need write-side sync hooks in three separate modules every
// time a class reschedules, an assignment is created, or an invoice is generated, the exact
// cross-module coupling this codebase's "each module owns its own domain" convention avoids.
// There's no point-in-time/historical need here either (unlike audit_logs, which genuinely needs
// snapshots) — a calendar always reflects the *current* state of its sources.
//
// docs/06 §6.2 "Calendar | F (own) | R (own) | R (child's) | R (institute) | R" — one
// `calendar.read` permission for every role; "F (own)" for a teacher doesn't mean this resource
// is itself writable, it means their own calendar reflects classes they can already
// schedule/reschedule elsewhere (ClassesController). `event_type` covers 'class_occurrence',
// 'assignment_due', and 'fee_due' — docs/03's sketched 'exam' and 'custom' have no backing data
// source anywhere in this codebase and aren't invented here; 'holiday' is partially covered via
// class-level `schedule_exceptions`, layering those onto materialized occurrences is a real,
// documented follow-up (the exact same simplification `ClassesService.getConflicts` already
// makes, for the same underlying reason — see this file's `classOccurrences` comment).
@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(ClassScheduleVersion)
    private readonly scheduleVersionRepo: Repository<ClassScheduleVersion>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Assignment)
    private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    private readonly teacherProfilesService: TeacherProfilesService,
  ) {}

  async getCalendar(
    requester: AuthenticatedUser,
    dto: CalendarQueryDto,
  ): Promise<CalendarEvent[]> {
    const from = new Date(`${dto.from}T00:00:00.000Z`);
    const to = new Date(`${dto.to}T23:59:59.999Z`);
    const scope = await this.resolveScope(
      requester,
      dto.ownerType,
      dto.ownerId,
    );

    const events: CalendarEvent[] = [];
    const occurrenceMeta = new Map<string, ClassOccurrenceMeta>();

    switch (scope.kind) {
      case 'teacher': {
        if (!scope.teacherProfileId) break;
        const classes = await this.classRepo.find({
          where: {
            teacherProfile: { id: scope.teacherProfileId },
            status: ClassStatus.ACTIVE,
          },
        });
        events.push(
          ...(await this.classOccurrences(classes, from, to, occurrenceMeta)),
        );
        events.push(
          ...(await this.assignmentDue(
            { teacherProfile: { id: scope.teacherProfileId } },
            from,
            to,
          )),
        );
        break;
      }
      case 'students': {
        for (const studentId of scope.studentProfileIds) {
          const enrollments = await this.enrollmentRepo.find({
            where: {
              student: { id: studentId },
              status: In([
                EnrollmentEntryStatus.ACTIVE,
                EnrollmentEntryStatus.TRIAL,
              ]),
            },
            relations: { class: true },
          });
          const classes = enrollments.map((e) => e.class);
          events.push(
            ...(await this.classOccurrences(classes, from, to, occurrenceMeta)),
          );
          events.push(
            ...(await this.assignmentDue(
              { student: { id: studentId } },
              from,
              to,
            )),
          );
          for (const cls of classes) {
            events.push(
              ...(await this.assignmentDue(
                { class: { id: cls.id } },
                from,
                to,
              )),
            );
          }
          events.push(...(await this.feeDue(studentId, from, to)));
        }
        break;
      }
      case 'class': {
        const cls = await this.classRepo.findOne({
          where: { id: scope.classId },
        });
        if (cls) {
          events.push(
            ...(await this.classOccurrences([cls], from, to, occurrenceMeta)),
          );
          events.push(
            ...(await this.assignmentDue(
              { class: { id: scope.classId } },
              from,
              to,
            )),
          );
        }
        break;
      }
      case 'institute': {
        const classes = await this.classRepo.find({
          where: {
            status: ClassStatus.ACTIVE,
            ...(scope.instituteId
              ? { institute: { id: scope.instituteId } }
              : {}),
          },
        });
        events.push(
          ...(await this.classOccurrences(classes, from, to, occurrenceMeta)),
        );
        break;
      }
    }

    this.flagConflicts(events, occurrenceMeta);
    events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return events;
  }

  // ---------------------------------------------------------------- Event sources ---------------

  // Deliberately ignores `schedule_exceptions` (holiday/cancelled/rescheduled/makeup) — raw
  // recurring occurrences only, matching `ClassesService.getConflicts`'s own exact simplification
  // for the same reason (see this file's header comment).
  private async classOccurrences(
    classes: Class[],
    from: Date,
    to: Date,
    metaOut: Map<string, ClassOccurrenceMeta>,
  ): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    for (const cls of classes) {
      const version = await this.scheduleVersionRepo.findOne({
        where: { class: { id: cls.id }, effectiveTo: IsNull() },
        order: { effectiveFrom: 'DESC' },
      });
      if (!version) continue;
      const occurrences = materializeOccurrences(version, from, to);
      const full = await this.classRepo.findOne({
        where: { id: cls.id },
        relations: { teacherProfile: true, institute: true },
      });
      if (!full) continue;
      metaOut.set(cls.id, {
        classId: cls.id,
        teacherProfileId: full.teacherProfile.id,
        instituteId: full.institute?.id ?? null,
        locationOrMeetingLink: full.locationOrMeetingLink ?? null,
      });
      for (const occ of occurrences) {
        events.push({
          id: `class_occurrence:${cls.id}:${occ.start.toISOString()}`,
          eventType: 'class_occurrence',
          sourceId: cls.id,
          title: full.name,
          startsAt: occ.start,
          endsAt: occ.end,
          conflict: false,
        });
      }
    }
    return events;
  }

  // `where` always names exactly one of `class`/`student`/`teacherProfile` — AssignmentsService
  // enforces "exactly one of class_id/student_id" at write time, so a class-scoped query here can
  // never also match (and double-count) a student-direct assignment, or vice versa; no dedup
  // needed between the per-class and per-student calls in the `students` scope branch above.
  private async assignmentDue(
    where: Record<string, unknown>,
    from: Date,
    to: Date,
  ): Promise<CalendarEvent[]> {
    const assignments = await this.assignmentRepo.find({
      where: { ...where, dueAt: Between(from, to) },
    });
    return assignments.map((a) => ({
      id: `assignment_due:${a.id}`,
      eventType: 'assignment_due' as const,
      sourceId: a.id,
      title: a.title,
      startsAt: a.dueAt,
      endsAt: a.dueAt,
      conflict: false,
    }));
  }

  private async feeDue(
    studentId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarEvent[]> {
    const invoices = await this.invoiceRepo.find({
      where: { student: { id: studentId } },
    });
    return invoices
      .filter((inv) => {
        const due = new Date(`${inv.dueDate}T00:00:00.000Z`);
        return due >= from && due <= to;
      })
      .map((inv) => {
        const due = new Date(`${inv.dueDate}T00:00:00.000Z`);
        return {
          id: `fee_due:${inv.id}`,
          eventType: 'fee_due' as const,
          sourceId: inv.id,
          title: `Fee due — ${inv.currency} ${inv.totalAmount}`,
          startsAt: due,
          endsAt: due,
          conflict: false,
        };
      });
  }

  // ---------------------------------------------------------------- Conflict flagging -----------

  // docs/07 Phase 5 step 6 "conflict detection surfaced in UI" — reuses the two rules
  // `ClassesService.getConflicts` already checks (teacher double-booking, same-institute
  // location clash), but computed over whatever's already been fetched to build this calendar
  // rather than a fresh per-class query — every class_occurrence event in scope is already in
  // hand, so this is a plain pairwise overlap check, not N more database round trips.
  private flagConflicts(
    events: CalendarEvent[],
    metaByClassId: Map<string, ClassOccurrenceMeta>,
  ): void {
    const occurrenceEvents = events.filter(
      (e) => e.eventType === 'class_occurrence',
    );
    for (let i = 0; i < occurrenceEvents.length; i++) {
      for (let j = i + 1; j < occurrenceEvents.length; j++) {
        const a = occurrenceEvents[i];
        const b = occurrenceEvents[j];
        if (a.sourceId === b.sourceId) continue; // same class, not a conflict with itself
        if (
          !occurrencesOverlap(
            { start: a.startsAt, end: a.endsAt },
            { start: b.startsAt, end: b.endsAt },
          )
        ) {
          continue;
        }
        const metaA = metaByClassId.get(a.sourceId);
        const metaB = metaByClassId.get(b.sourceId);
        if (!metaA || !metaB) continue;

        if (metaA.teacherProfileId === metaB.teacherProfileId) {
          a.conflict = true;
          a.conflictReason = 'teacher_double_booking';
          b.conflict = true;
          b.conflictReason = 'teacher_double_booking';
        } else if (
          metaA.instituteId &&
          metaA.instituteId === metaB.instituteId &&
          metaA.locationOrMeetingLink &&
          metaA.locationOrMeetingLink === metaB.locationOrMeetingLink
        ) {
          a.conflict = true;
          a.conflictReason = a.conflictReason ?? 'location_conflict';
          b.conflict = true;
          b.conflictReason = b.conflictReason ?? 'location_conflict';
        }
      }
    }
  }

  // ---------------------------------------------------------------- Scope resolution -----------

  private async resolveScope(
    requester: AuthenticatedUser,
    ownerType?: 'class' | 'institute',
    ownerId?: string,
  ): Promise<Scope> {
    if (ownerType === 'class') {
      if (!ownerId) {
        throw new BadRequestException({
          code: 'OWNER_ID_REQUIRED',
          message: 'ownerId is required when ownerType is "class"',
        });
      }
      await this.assertClassAccess(ownerId, requester);
      return { kind: 'class', classId: ownerId };
    }
    if (ownerType === 'institute') {
      if (!ownerId) {
        throw new BadRequestException({
          code: 'OWNER_ID_REQUIRED',
          message: 'ownerId is required when ownerType is "institute"',
        });
      }
      this.assertInstituteAccess(ownerId, requester);
      return { kind: 'institute', instituteId: ownerId };
    }

    // No explicit owner — "my own calendar", resolved per role.
    switch (requester.activeRole) {
      case 'teacher': {
        const teacherProfile = await this.teacherProfilesService.findByUserId(
          requester.userId,
        );
        return { kind: 'teacher', teacherProfileId: teacherProfile?.id ?? '' };
      }
      case 'student': {
        const student = await this.studentRepo.findOne({
          where: { user: { id: requester.userId } },
        });
        return {
          kind: 'students',
          studentProfileIds: student ? [student.id] : [],
        };
      }
      case 'parent': {
        const links = await this.guardianLinkRepo.find({
          where: { guardian: { user: { id: requester.userId } } },
          relations: { student: true },
        });
        return {
          kind: 'students',
          studentProfileIds: links.map((l) => l.student.id),
        };
      }
      case 'institute_admin':
        return { kind: 'institute', instituteId: requester.instituteId ?? '' };
      default: // super_admin
        return { kind: 'institute', instituteId: undefined };
    }
  }

  private async assertClassAccess(
    classId: string,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (requester.activeRole === 'super_admin') return;

    const cls = await this.classRepo.findOne({
      where: { id: classId },
      relations: { teacherProfile: true, institute: true },
    });
    if (!cls) return; // 404-shaped: getCalendar simply returns no events for a missing class

    if (requester.activeRole === 'institute_admin') {
      if (cls.institute?.id && cls.institute.id === requester.instituteId)
        return;
    }
    if (requester.activeRole === 'teacher') {
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (teacherProfile && teacherProfile.id === cls.teacherProfile.id) return;
    }
    if (requester.activeRole === 'student') {
      const student = await this.studentRepo.findOne({
        where: { user: { id: requester.userId } },
      });
      if (student) {
        const enrolled = await this.enrollmentRepo.findOne({
          where: {
            student: { id: student.id },
            class: { id: classId },
            status: In([
              EnrollmentEntryStatus.ACTIVE,
              EnrollmentEntryStatus.TRIAL,
            ]),
          },
        });
        if (enrolled) return;
      }
    }
    if (requester.activeRole === 'parent') {
      const links = await this.guardianLinkRepo.find({
        where: { guardian: { user: { id: requester.userId } } },
        relations: { student: true },
      });
      for (const link of links) {
        const enrolled = await this.enrollmentRepo.findOne({
          where: {
            student: { id: link.student.id },
            class: { id: classId },
            status: In([
              EnrollmentEntryStatus.ACTIVE,
              EnrollmentEntryStatus.TRIAL,
            ]),
          },
        });
        if (enrolled) return;
      }
    }

    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_CLASS_CALENDAR',
      message: 'You do not have access to this class’s calendar',
    });
  }

  private assertInstituteAccess(
    instituteId: string,
    requester: AuthenticatedUser,
  ): void {
    if (requester.activeRole === 'super_admin') return;
    if (
      requester.activeRole === 'institute_admin' &&
      requester.instituteId === instituteId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_INSTITUTE_CALENDAR',
      message: 'You do not have access to this institute’s calendar',
    });
  }
}
