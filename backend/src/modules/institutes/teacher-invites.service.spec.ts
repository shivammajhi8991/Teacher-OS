import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeacherInvitesService } from './teacher-invites.service';
import { TeacherInstituteInvite } from './entities/teacher-institute-invite.entity';
import { Institute } from './entities/institute.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

describe('TeacherInvitesService', () => {
  let service: TeacherInvitesService;
  const inviteRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'invite-1', ...d })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const instituteRepo = { findOne: jest.fn() };
  const teacherProfileRepo = { findOne: jest.fn(), update: jest.fn() };
  const teacherProfilesService = { findByUserId: jest.fn() };

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
    const module = await Test.createTestingModule({
      providers: [
        TeacherInvitesService,
        {
          provide: getRepositoryToken(TeacherInstituteInvite),
          useValue: inviteRepo,
        },
        { provide: getRepositoryToken(Institute), useValue: instituteRepo },
        {
          provide: getRepositoryToken(TeacherProfile),
          useValue: teacherProfileRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
      ],
    }).compile();
    service = module.get(TeacherInvitesService);
  });

  describe('createInvite', () => {
    it('rejects an institute_admin creating an invite for another institute', async () => {
      await expect(
        service.createInvite('institute-1', otherAdmin, { expiresInDays: 7 }),
      ).rejects.toThrow(ForbiddenException);
      expect(inviteRepo.save).not.toHaveBeenCalled();
    });

    it("generates a code and saves an invite for an institute_admin's own institute", async () => {
      instituteRepo.findOne.mockResolvedValue({
        id: 'institute-1',
        name: 'Institute 1',
      });
      const summary = await service.createInvite('institute-1', ownAdmin, {
        expiresInDays: 3,
      });
      expect(inviteRepo.save).toHaveBeenCalled();
      expect(summary.code).toMatch(/^[0-9a-f]{10}$/);
    });
  });

  describe('redeemInvite', () => {
    it('rejects a user with no teacher profile', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue(null);
      await expect(service.redeemInvite(teacherUser, 'abc123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects an invalid, expired, or already-used code', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      inviteRepo.findOne.mockResolvedValue(null);
      await expect(
        service.redeemInvite(teacherUser, 'bad-code'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a teacher already affiliated with an institute', async () => {
      // findByUserId() loads `institute` itself (teacher-profiles.service.ts) — no separate
      // re-query in the real service any more, so the mock carries it directly.
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
        institute: { id: 'institute-existing' },
      });
      inviteRepo.findOne.mockResolvedValue({
        code: 'abc123',
        institute: { id: 'institute-1', name: 'Institute 1' },
      });

      await expect(service.redeemInvite(teacherUser, 'abc123')).rejects.toThrow(
        ConflictException,
      );
      expect(teacherProfileRepo.update).not.toHaveBeenCalled();
    });

    it("joins the teacher to the invite's institute and marks the invite redeemed", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
        institute: null,
      });
      const invite = {
        id: 'invite-1',
        code: 'abc123',
        institute: { id: 'institute-1', name: 'Institute 1' },
        redeemedAt: null as Date | null,
      };
      inviteRepo.findOne.mockResolvedValue(invite);

      const result = await service.redeemInvite(teacherUser, 'abc123');

      expect(teacherProfileRepo.update).toHaveBeenCalledWith(
        'teacher-profile-1',
        {
          institute: invite.institute,
        },
      );
      expect(inviteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ redeemedAt: expect.any(Date) }),
      );
      expect(result).toEqual({
        instituteId: 'institute-1',
        instituteName: 'Institute 1',
      });
    });
  });
});
