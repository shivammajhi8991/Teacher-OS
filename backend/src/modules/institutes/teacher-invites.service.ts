import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { TeacherInstituteInvite } from './entities/teacher-institute-invite.entity';
import { Institute } from './entities/institute.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateTeacherInviteDto } from './dto/create-teacher-invite.dto';

export interface TeacherInviteSummary {
  id: string;
  code: string;
  expiresAt: Date;
  redeemedAt: Date | null;
}

// docs/08 §8.2 Institute Admin "Teachers list / detail: Roster, invite, verification status,
// payout config." Mirrors StudentInvite's code-generation shape (students.service.ts's
// createInvite) — same randomBytes(5).toString('hex') scheme, same "generation now, this is the
// whole flow" scope (no email delivery — the code is handed to the teacher out of band, same as
// the student invite).
@Injectable()
export class TeacherInvitesService {
  constructor(
    @InjectRepository(TeacherInstituteInvite)
    private readonly inviteRepo: Repository<TeacherInstituteInvite>,
    @InjectRepository(Institute)
    private readonly instituteRepo: Repository<Institute>,
    @InjectRepository(TeacherProfile)
    private readonly teacherProfileRepo: Repository<TeacherProfile>,
    private readonly teacherProfilesService: TeacherProfilesService,
  ) {}

  async createInvite(
    instituteId: string,
    requester: AuthenticatedUser,
    dto: CreateTeacherInviteDto,
  ): Promise<TeacherInviteSummary> {
    this.assertInstituteAccess(instituteId, requester);
    const institute = await this.instituteRepo.findOne({
      where: { id: instituteId },
    });
    if (!institute) {
      throw new NotFoundException({
        code: 'INSTITUTE_NOT_FOUND',
        message: `Institute ${instituteId} not found`,
      });
    }

    const code = randomBytes(5).toString('hex');
    const expiresAt = new Date(
      Date.now() + (dto.expiresInDays ?? 7) * 24 * 60 * 60 * 1000,
    );
    const invite = await this.inviteRepo.save(
      this.inviteRepo.create({
        institute,
        code,
        createdBy: { id: requester.userId } as User,
        expiresAt,
      }),
    );
    return this.toSummary(invite);
  }

  async listInvites(
    instituteId: string,
    requester: AuthenticatedUser,
  ): Promise<TeacherInviteSummary[]> {
    this.assertInstituteAccess(instituteId, requester);
    const invites = await this.inviteRepo.find({
      where: { institute: { id: instituteId } },
      order: { createdAt: 'DESC' },
    });
    return invites.map((i) => this.toSummary(i));
  }

  // A teacher redeeming a code must already have completed onboarding (docs/07 Phase 4 step 2)
  // — this joins an *existing* profile to an institute, it never creates one. Rejects outright
  // if that teacher is already affiliated with a (possibly different) institute, rather than
  // silently reassigning them — an explicit transfer flow is a real, separate feature this pass
  // doesn't build.
  async redeemInvite(
    requester: AuthenticatedUser,
    code: string,
  ): Promise<{ instituteId: string; instituteName: string }> {
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (!teacherProfile) {
      throw new ForbiddenException({
        code: 'TEACHER_PROFILE_REQUIRED',
        message: 'Complete your teacher profile before joining an institute',
      });
    }

    const invite = await this.inviteRepo.findOne({
      where: { code, redeemedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      relations: { institute: true },
    });
    if (!invite) {
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'This invite code is invalid, expired, or already used',
      });
    }

    // findByUserId() now loads `institute` itself (teacher-profiles.service.ts fixed this — it
    // used to silently return `undefined` here), so no separate re-query is needed.
    if (teacherProfile.institute?.id) {
      throw new ConflictException({
        code: 'ALREADY_AFFILIATED',
        message: 'This teacher profile is already affiliated with an institute',
      });
    }

    await this.teacherProfileRepo.update(teacherProfile.id, {
      institute: invite.institute,
    });

    invite.redeemedAt = new Date();
    invite.redeemedByTeacherProfile = teacherProfile;
    await this.inviteRepo.save(invite);

    return {
      instituteId: invite.institute.id,
      instituteName: invite.institute.name,
    };
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
      code: 'NOT_AUTHORIZED_FOR_INSTITUTE',
      message:
        'You do not have permission to manage invites for this institute',
    });
  }

  private toSummary(invite: TeacherInstituteInvite): TeacherInviteSummary {
    return {
      id: invite.id,
      code: invite.code,
      expiresAt: invite.expiresAt,
      redeemedAt: invite.redeemedAt ?? null,
    };
  }
}
