import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InstituteTeacherPayout,
  PayoutStatus,
} from './entities/institute-teacher-payout.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

export interface PayoutSummary {
  id: string;
  teacherProfileId: string;
  invoiceId: string;
  payoutPercent: string;
  payoutAmount: string;
  status: PayoutStatus;
  paidAt: Date | null;
  createdAt: Date;
}

// docs/03 §3.7 `institute_teacher_payouts` (docs/01 §1.3 "Institute → Teacher revenue split").
// Payout *generation* happens in FeesService, at the moment a payment is confirmed — see that
// file's `generatePayoutIfApplicable` for why it lives there (it already has the payment,
// invoice, and teacherProfile loaded). This service is the read/manage side: setting a teacher's
// payout_percent and marking a generated payout paid.
@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(InstituteTeacherPayout)
    private readonly payoutRepo: Repository<InstituteTeacherPayout>,
    @InjectRepository(TeacherProfile)
    private readonly teacherProfileRepo: Repository<TeacherProfile>,
    private readonly teacherProfilesService: TeacherProfilesService,
  ) {}

  async setPayoutPercent(
    teacherProfileId: string,
    requester: AuthenticatedUser,
    payoutPercent: number,
  ): Promise<void> {
    const teacherProfile = await this.teacherProfileRepo.findOne({
      where: { id: teacherProfileId },
      relations: { institute: true },
    });
    if (!teacherProfile) {
      throw new NotFoundException({
        code: 'TEACHER_PROFILE_NOT_FOUND',
        message: `Teacher profile ${teacherProfileId} not found`,
      });
    }
    if (
      requester.activeRole !== 'super_admin' &&
      (requester.activeRole !== 'institute_admin' ||
        !teacherProfile.institute ||
        teacherProfile.institute.id !== requester.instituteId)
    ) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_TEACHER',
        message:
          'You can only configure payouts for teachers in your own institute',
      });
    }

    await this.teacherProfileRepo.update(teacherProfileId, {
      payoutPercent: payoutPercent.toFixed(2),
    });
  }

  async listPayouts(requester: AuthenticatedUser): Promise<PayoutSummary[]> {
    let payouts: InstituteTeacherPayout[];
    const relations = { teacherProfile: true, invoice: true } as const;

    if (requester.activeRole === 'super_admin') {
      payouts = await this.payoutRepo.find({
        relations,
        order: { createdAt: 'DESC' },
      });
    } else if (requester.activeRole === 'institute_admin') {
      if (!requester.instituteId) return [];
      payouts = await this.payoutRepo.find({
        where: { institute: { id: requester.instituteId } },
        relations,
        order: { createdAt: 'DESC' },
      });
    } else {
      // teacher — their own payouts only.
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (!teacherProfile) return [];
      payouts = await this.payoutRepo.find({
        where: { teacherProfile: { id: teacherProfile.id } },
        relations,
        order: { createdAt: 'DESC' },
      });
    }

    return payouts.map((p) => this.toSummary(p));
  }

  async markPaid(
    payoutId: string,
    requester: AuthenticatedUser,
  ): Promise<PayoutSummary> {
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId },
      relations: { institute: true, teacherProfile: true, invoice: true },
    });
    if (!payout) {
      throw new NotFoundException({
        code: 'PAYOUT_NOT_FOUND',
        message: `Payout ${payoutId} not found`,
      });
    }
    if (
      requester.activeRole !== 'super_admin' &&
      (requester.activeRole !== 'institute_admin' ||
        payout.institute.id !== requester.instituteId)
    ) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_PAYOUT',
        message: 'You do not have permission to manage this payout',
      });
    }
    if (payout.status === PayoutStatus.PAID) {
      throw new ConflictException({
        code: 'PAYOUT_ALREADY_PAID',
        message: 'This payout has already been marked paid',
      });
    }

    payout.status = PayoutStatus.PAID;
    payout.paidAt = new Date();
    const saved = await this.payoutRepo.save(payout);
    return this.toSummary(saved);
  }

  private toSummary(payout: InstituteTeacherPayout): PayoutSummary {
    return {
      id: payout.id,
      teacherProfileId: payout.teacherProfile.id,
      invoiceId: payout.invoice.id,
      payoutPercent: payout.payoutPercent,
      payoutAmount: payout.payoutAmount,
      status: payout.status,
      paidAt: payout.paidAt ?? null,
      createdAt: payout.createdAt,
    };
  }
}
