import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PayoutsService } from './payouts.service';
import {
  InstituteTeacherPayout,
  PayoutStatus,
} from './entities/institute-teacher-payout.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/03 §3.7 "Institute → Teacher revenue split." Generation itself is exercised in
// fees.service.spec.ts (generatePayoutIfApplicable); this covers the read/manage side —
// setting a teacher's payout_percent, listing payouts by role scope, and marking one paid.
describe('PayoutsService', () => {
  let service: PayoutsService;
  const payoutRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const teacherProfileRepo = { findOne: jest.fn(), update: jest.fn() };
  const teacherProfilesService = { findByUserId: jest.fn() };

  const superAdmin: AuthenticatedUser = {
    userId: 'user-super',
    activeRole: 'super_admin',
    instituteId: null,
  };
  const ownAdmin: AuthenticatedUser = {
    userId: 'user-admin',
    activeRole: 'institute_admin',
    instituteId: 'institute-1',
  };
  const otherAdmin: AuthenticatedUser = {
    userId: 'user-other-admin',
    activeRole: 'institute_admin',
    instituteId: 'institute-2',
  };
  const teacherUser: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    payoutRepo.find.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        PayoutsService,
        {
          provide: getRepositoryToken(InstituteTeacherPayout),
          useValue: payoutRepo,
        },
        {
          provide: getRepositoryToken(TeacherProfile),
          useValue: teacherProfileRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
      ],
    }).compile();
    service = module.get(PayoutsService);
  });

  describe('setPayoutPercent', () => {
    it('rejects an institute_admin configuring a teacher outside their own institute', async () => {
      teacherProfileRepo.findOne.mockResolvedValue({
        id: 'teacher-profile-1',
        institute: { id: 'institute-1' },
      });
      await expect(
        service.setPayoutPercent('teacher-profile-1', otherAdmin, 30),
      ).rejects.toThrow(ForbiddenException);
      expect(teacherProfileRepo.update).not.toHaveBeenCalled();
    });

    it('allows an institute_admin to configure a teacher of their own institute', async () => {
      teacherProfileRepo.findOne.mockResolvedValue({
        id: 'teacher-profile-1',
        institute: { id: 'institute-1' },
      });
      await service.setPayoutPercent('teacher-profile-1', ownAdmin, 30);
      expect(teacherProfileRepo.update).toHaveBeenCalledWith(
        'teacher-profile-1',
        {
          payoutPercent: '30.00',
        },
      );
    });

    it('404s for a nonexistent teacher profile', async () => {
      teacherProfileRepo.findOne.mockResolvedValue(null);
      await expect(
        service.setPayoutPercent('missing', superAdmin, 30),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPayouts', () => {
    it("scopes an institute_admin's listing to their own institute", async () => {
      await service.listPayouts(ownAdmin);
      expect(payoutRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { institute: { id: 'institute-1' } },
        }),
      );
    });

    it("scopes a teacher's listing to their own payouts", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      await service.listPayouts(teacherUser);
      expect(payoutRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teacherProfile: { id: 'teacher-profile-1' } },
        }),
      );
    });

    it('returns an empty list for a teacher with no profile yet, rather than throwing', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      await expect(service.listPayouts(teacherUser)).resolves.toEqual([]);
    });
  });

  describe('markPaid', () => {
    it('rejects an institute_admin marking a payout of another institute paid', async () => {
      payoutRepo.findOne.mockResolvedValue({
        id: 'payout-1',
        institute: { id: 'institute-1' },
        status: PayoutStatus.PENDING,
      });
      await expect(service.markPaid('payout-1', otherAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects marking an already-paid payout paid again', async () => {
      payoutRepo.findOne.mockResolvedValue({
        id: 'payout-1',
        institute: { id: 'institute-1' },
        status: PayoutStatus.PAID,
      });
      await expect(service.markPaid('payout-1', ownAdmin)).rejects.toThrow(
        ConflictException,
      );
    });

    it("marks a pending payout of the admin's own institute paid", async () => {
      const payout = {
        id: 'payout-1',
        institute: { id: 'institute-1' },
        teacherProfile: { id: 'teacher-profile-1' },
        invoice: { id: 'invoice-1' },
        payoutPercent: '30.00',
        payoutAmount: '300.00',
        status: PayoutStatus.PENDING,
        createdAt: new Date(),
      };
      payoutRepo.findOne.mockResolvedValue(payout);

      const result = await service.markPaid('payout-1', ownAdmin);

      expect(payoutRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PayoutStatus.PAID,
          paidAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(PayoutStatus.PAID);
    });
  });
});
