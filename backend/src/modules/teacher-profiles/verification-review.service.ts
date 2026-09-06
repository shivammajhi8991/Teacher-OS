import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VerificationRequest,
  VerificationRequestStatus,
} from './entities/verification-request.entity';
import {
  TeacherProfile,
  VerificationStatus,
} from './entities/teacher-profile.entity';
import { ReviewVerificationRequestDto } from './dto/review-verification-request.dto';
import { User } from '../users/entities/user.entity';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

export interface VerificationQueueEntry {
  id: string;
  teacherProfileId: string;
  teacherFullName: string;
  documentUrls: string[];
  createdAt: Date;
}

// docs/01 §1.2 point 6 "verification status ... needs an actual admin-reviewed workflow, not a
// self-reported boolean" — verification-request.entity.ts's own header comment flagged this
// review side as shipping "with the admin module." `verification.review` (super_admin only,
// docs/06 §6.2 "Verification review | – | – | – | – | F") — an institute_admin never reviews
// their own teachers' verification, this is a platform-level trust decision.
@Injectable()
export class VerificationReviewService {
  constructor(
    @InjectRepository(VerificationRequest)
    private readonly requestRepo: Repository<VerificationRequest>,
    @InjectRepository(TeacherProfile)
    private readonly profileRepo: Repository<TeacherProfile>,
  ) {}

  async listQueue(): Promise<VerificationQueueEntry[]> {
    // Never load a related `User` without a column-restricted `select` if the entity can reach a
    // client (TeacherProfilesService.findById's own established pattern) — loading `user: true`
    // unrestricted here would have put `passwordHash` straight into this response.
    const requests = await this.requestRepo.find({
      where: { status: VerificationRequestStatus.PENDING },
      relations: { teacherProfile: { user: true } },
      select: {
        id: true,
        documentUrls: true,
        createdAt: true,
        teacherProfile: { id: true, user: { id: true, fullName: true } },
      },
      order: { createdAt: 'ASC' },
    });
    return requests.map((r) => ({
      id: r.id,
      teacherProfileId: r.teacherProfile.id,
      teacherFullName: r.teacherProfile.user.fullName,
      documentUrls: r.documentUrls,
      createdAt: r.createdAt,
    }));
  }

  async review(
    id: string,
    requester: AuthenticatedUser,
    dto: ReviewVerificationRequestDto,
  ): Promise<VerificationRequest> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: { teacherProfile: true },
    });
    if (!request) {
      throw new NotFoundException({
        code: 'VERIFICATION_REQUEST_NOT_FOUND',
        message: `Verification request ${id} not found`,
      });
    }
    if (request.status !== VerificationRequestStatus.PENDING) {
      throw new ConflictException({
        code: 'VERIFICATION_REQUEST_ALREADY_REVIEWED',
        message: `This request was already ${request.status}`,
      });
    }

    request.status =
      dto.decision === 'approved'
        ? VerificationRequestStatus.APPROVED
        : VerificationRequestStatus.REJECTED;
    request.reviewedBy = { id: requester.userId } as User;
    request.reviewedAt = new Date();
    request.rejectionReason =
      dto.decision === 'rejected' ? dto.rejectionReason : undefined;
    await this.requestRepo.save(request);

    // docs/01 §1.2 point 6 — approval/rejection flips the teacher profile's own status; a
    // rejection returns to 'unverified' (not a distinct "rejected" profile state — the teacher
    // can address the reason and resubmit) rather than leaving it permanently stuck at 'pending'.
    const newVerificationStatus =
      dto.decision === 'approved'
        ? VerificationStatus.VERIFIED
        : VerificationStatus.UNVERIFIED;
    await this.profileRepo.update(request.teacherProfile.id, {
      verificationStatus: newVerificationStatus,
    });
    // The in-memory `teacherProfile` snapshot was loaded before this update — reflect it here too
    // so the response the caller actually sees isn't a moment stale on the one field this whole
    // endpoint exists to change.
    request.teacherProfile.verificationStatus = newVerificationStatus;

    return request;
  }
}
