import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  Announcement,
  AnnouncementTargetType,
} from './entities/announcement.entity';
import { Class } from '../classes/entities/class.entity';
import {
  Enrollment,
  EnrollmentEntryStatus,
} from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { Institute } from '../institutes/entities/institute.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

export interface AnnouncementSummary {
  id: string;
  targetType: AnnouncementTargetType;
  targetId: string | null;
  title: string;
  body: string;
  createdAt: Date;
}

type Target = { type: AnnouncementTargetType; id: string | null };

// docs/03 §3.8 / docs/06 §6.2 "Announcements." Three independent "send" grants (teacher: own
// classes, institute_admin: institute-wide, super_admin: platform-wide) but one shared "read: R"
// for everyone — resolved the same way NotesService resolves "what am I allowed to see": build a
// list of relevant targets for the requester (their institute, their classes, PLATFORM always),
// then fetch whatever matches. Duplicated rather than shared with NotesService by this
// codebase's established "each module owns its own access resolution" convention.
@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    private readonly teacherProfilesService: TeacherProfilesService,
  ) {}

  async createAnnouncement(
    requester: AuthenticatedUser,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementSummary> {
    let institute: { id: string } | null = null;
    let targetId: string | null = null;

    if (requester.activeRole === 'super_admin') {
      if (dto.targetType !== AnnouncementTargetType.PLATFORM) {
        throw new ForbiddenException({
          code: 'SUPER_ADMIN_PLATFORM_ONLY',
          message: 'super_admin can only send platform-wide announcements',
        });
      }
    } else if (requester.activeRole === 'institute_admin') {
      if (dto.targetType !== AnnouncementTargetType.INSTITUTE) {
        throw new ForbiddenException({
          code: 'INSTITUTE_ADMIN_INSTITUTE_ONLY',
          message: 'institute_admin can only send institute-wide announcements',
        });
      }
      if (!requester.instituteId) {
        throw new ForbiddenException({
          code: 'NO_INSTITUTE',
          message:
            'You must belong to an institute to send an institute-wide announcement',
        });
      }
      if (dto.targetId && dto.targetId !== requester.instituteId) {
        throw new ForbiddenException({
          code: 'NOT_AUTHORIZED_FOR_INSTITUTE',
          message: 'You can only send announcements for your own institute',
        });
      }
      institute = { id: requester.instituteId };
      targetId = requester.instituteId;
    } else if (requester.activeRole === 'teacher') {
      if (dto.targetType !== AnnouncementTargetType.CLASS) {
        throw new ForbiddenException({
          code: 'TEACHER_CLASS_ONLY',
          message:
            'A teacher can only send an announcement to one of their own classes',
        });
      }
      if (!dto.targetId) {
        throw new BadRequestException({
          code: 'TARGET_ID_REQUIRED',
          message:
            'targetId (a classId) is required for a class-targeted announcement',
        });
      }
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      const cls = teacherProfile
        ? await this.classRepo.findOne({
            where: { id: dto.targetId },
            relations: { teacherProfile: true },
          })
        : null;
      if (
        !teacherProfile ||
        !cls ||
        cls.teacherProfile.id !== teacherProfile.id
      ) {
        throw new ForbiddenException({
          code: 'NOT_AUTHORIZED_FOR_CLASS',
          message: 'You do not teach this class',
        });
      }
      targetId = dto.targetId;
    } else {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_TO_SEND',
        message: 'You do not have permission to send announcements',
      });
    }

    const announcement = await this.announcementRepo.save(
      this.announcementRepo.create({
        institute: institute ? ({ id: institute.id } as Institute) : null,
        createdBy: { id: requester.userId } as User,
        targetType: dto.targetType,
        targetId,
        title: dto.title,
        body: dto.body,
      }),
    );
    return this.toSummary(announcement);
  }

  async listAnnouncements(
    requester: AuthenticatedUser,
  ): Promise<AnnouncementSummary[]> {
    if (requester.activeRole === 'super_admin') {
      const all = await this.announcementRepo.find({
        order: { createdAt: 'DESC' },
      });
      return all.map((a) => this.toSummary(a));
    }

    const targets = await this.getRelevantTargets(requester);
    const where = targets.map((t) =>
      t.id === null
        ? { targetType: t.type, targetId: IsNull() }
        : { targetType: t.type, targetId: t.id },
    );
    if (where.length === 0) return [];

    const announcements = await this.announcementRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return announcements.map((a) => this.toSummary(a));
  }

  // ---------------------------------------------------------------- Relevant targets -----------

  private async getRelevantTargets(
    requester: AuthenticatedUser,
  ): Promise<Target[]> {
    const targets: Target[] = [
      { type: AnnouncementTargetType.PLATFORM, id: null },
    ];

    if (requester.activeRole === 'institute_admin') {
      if (requester.instituteId) {
        targets.push({
          type: AnnouncementTargetType.INSTITUTE,
          id: requester.instituteId,
        });
        const classes = await this.classRepo.find({
          where: { institute: { id: requester.instituteId } },
        });
        for (const c of classes)
          targets.push({ type: AnnouncementTargetType.CLASS, id: c.id });
      }
      return targets;
    }

    if (requester.activeRole === 'teacher') {
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (teacherProfile) {
        // findByUserId() now loads `institute` itself (teacher-profiles.service.ts fixed this —
        // it used to silently return `undefined` here), so no separate re-query is needed.
        if (teacherProfile.institute?.id) {
          targets.push({
            type: AnnouncementTargetType.INSTITUTE,
            id: teacherProfile.institute.id,
          });
        }
        const classes = await this.classRepo.find({
          where: { teacherProfile: { id: teacherProfile.id } },
        });
        for (const c of classes)
          targets.push({ type: AnnouncementTargetType.CLASS, id: c.id });
      }
      return targets;
    }

    if (requester.activeRole === 'student') {
      const student = await this.studentRepo.findOne({
        where: { user: { id: requester.userId } },
        relations: { institute: true },
      });
      if (student) {
        if (student.institute?.id) {
          targets.push({
            type: AnnouncementTargetType.INSTITUTE,
            id: student.institute.id,
          });
        }
        const enrollments = await this.enrollmentRepo.find({
          where: {
            student: { id: student.id },
            status: In([
              EnrollmentEntryStatus.ACTIVE,
              EnrollmentEntryStatus.TRIAL,
            ]),
          },
          relations: { class: true },
        });
        for (const e of enrollments)
          targets.push({ type: AnnouncementTargetType.CLASS, id: e.class.id });
      }
      return targets;
    }

    if (requester.activeRole === 'parent') {
      const links = await this.guardianLinkRepo.find({
        where: { guardian: { user: { id: requester.userId } } },
        relations: { student: { institute: true } },
      });
      for (const link of links) {
        if (link.student.institute?.id) {
          targets.push({
            type: AnnouncementTargetType.INSTITUTE,
            id: link.student.institute.id,
          });
        }
        const enrollments = await this.enrollmentRepo.find({
          where: {
            student: { id: link.student.id },
            status: In([
              EnrollmentEntryStatus.ACTIVE,
              EnrollmentEntryStatus.TRIAL,
            ]),
          },
          relations: { class: true },
        });
        for (const e of enrollments)
          targets.push({ type: AnnouncementTargetType.CLASS, id: e.class.id });
      }
      return targets;
    }

    return targets;
  }

  private toSummary(announcement: Announcement): AnnouncementSummary {
    return {
      id: announcement.id,
      targetType: announcement.targetType,
      targetId: announcement.targetId ?? null,
      title: announcement.title,
      body: announcement.body,
      createdAt: announcement.createdAt,
    };
  }
}
