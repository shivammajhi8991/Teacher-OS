import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VerificationReviewService } from './verification-review.service';
import {
  VerificationRequest,
  VerificationRequestStatus,
} from './entities/verification-request.entity';
import {
  TeacherProfile,
  VerificationStatus,
} from './entities/teacher-profile.entity';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

describe('VerificationReviewService', () => {
  let service: VerificationReviewService;
  const requestRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const profileRepo = { update: jest.fn() };

  const superAdmin: AuthenticatedUser = {
    userId: 'user-super',
    activeRole: 'super_admin',
    instituteId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        VerificationReviewService,
        {
          provide: getRepositoryToken(VerificationRequest),
          useValue: requestRepo,
        },
        { provide: getRepositoryToken(TeacherProfile), useValue: profileRepo },
      ],
    }).compile();
    service = module.get(VerificationReviewService);
  });

  describe('listQueue', () => {
    // Regression guard for a real bug caught in review: loading `relations: { teacherProfile: {
    // user: true } }` with no `select` restriction would have put the full `User` entity —
    // `passwordHash` included — straight into this admin-facing response. Asserting the exact
    // shape returned (not just "no passwordHash key") is what actually catches a regression here,
    // since a shape check only passes when the mapped summary, not the raw entity, is returned.
    it('shapes each entry without ever exposing the underlying User entity', async () => {
      requestRepo.find.mockResolvedValue([
        {
          id: 'request-1',
          documentUrls: ['https://example.com/doc.pdf'],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          teacherProfile: {
            id: 'teacher-profile-1',
            user: { id: 'user-1', fullName: 'Jamie Lee' },
          },
        },
      ]);

      const queue = await service.listQueue();

      expect(queue).toEqual([
        {
          id: 'request-1',
          teacherProfileId: 'teacher-profile-1',
          teacherFullName: 'Jamie Lee',
          documentUrls: ['https://example.com/doc.pdf'],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            teacherProfile: { id: true, user: { id: true, fullName: true } },
          }),
        }),
      );
    });
  });

  describe('review', () => {
    it('404s for a nonexistent request', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(
        service.review('missing', superAdmin, { decision: 'approved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects reviewing a request that was already decided', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'request-1',
        status: VerificationRequestStatus.APPROVED,
        teacherProfile: { id: 'teacher-profile-1' },
      });
      await expect(
        service.review('request-1', superAdmin, { decision: 'rejected' }),
      ).rejects.toThrow(ConflictException);
      expect(profileRepo.update).not.toHaveBeenCalled();
    });

    it('approves a pending request and flips the profile to verified', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'request-1',
        status: VerificationRequestStatus.PENDING,
        teacherProfile: { id: 'teacher-profile-1' },
      });
      const result = await service.review('request-1', superAdmin, {
        decision: 'approved',
      });
      expect(result.status).toBe(VerificationRequestStatus.APPROVED);
      expect(profileRepo.update).toHaveBeenCalledWith('teacher-profile-1', {
        verificationStatus: VerificationStatus.VERIFIED,
      });
      // Regression guard: the returned `teacherProfile` snapshot was loaded before the update
      // above and must reflect it too, not read back as stale 'unverified'.
      expect(result.teacherProfile.verificationStatus).toBe(
        VerificationStatus.VERIFIED,
      );
    });

    it('rejects a pending request with a reason and flips the profile back to unverified', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'request-1',
        status: VerificationRequestStatus.PENDING,
        teacherProfile: { id: 'teacher-profile-1' },
      });
      const result = await service.review('request-1', superAdmin, {
        decision: 'rejected',
        rejectionReason: 'Document unreadable',
      });
      expect(result.status).toBe(VerificationRequestStatus.REJECTED);
      expect(result.rejectionReason).toBe('Document unreadable');
      expect(profileRepo.update).toHaveBeenCalledWith('teacher-profile-1', {
        verificationStatus: VerificationStatus.UNVERIFIED,
      });
    });
  });
});
