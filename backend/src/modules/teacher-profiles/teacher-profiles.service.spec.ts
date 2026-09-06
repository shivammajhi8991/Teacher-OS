import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeacherProfilesService } from './teacher-profiles.service';
import { TeacherCategory } from './entities/teacher-category.entity';
import {
  TeacherProfile,
  TeachingMode,
} from './entities/teacher-profile.entity';
import { VerificationRequest } from './entities/verification-request.entity';

// docs/05 §5.7-equivalent for the backend: the highest-value unit tests are the ones covering
// edge cases docs/01 §1.5 calls out explicitly — here, "only the owner can edit their profile"
// and "can't create a second profile for one user."
describe('TeacherProfilesService', () => {
  let service: TeacherProfilesService;
  const categoryRepo = { findOne: jest.fn(), find: jest.fn() };
  const profileRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const verificationRepo = { create: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TeacherProfilesService,
        {
          provide: getRepositoryToken(TeacherCategory),
          useValue: categoryRepo,
        },
        { provide: getRepositoryToken(TeacherProfile), useValue: profileRepo },
        {
          provide: getRepositoryToken(VerificationRequest),
          useValue: verificationRepo,
        },
      ],
    }).compile();

    service = module.get(TeacherProfilesService);
  });

  describe('createProfile', () => {
    it('rejects a second profile for the same user', async () => {
      profileRepo.findOne.mockResolvedValue({ id: 'existing-profile' });

      await expect(
        service.createProfile('user-1', {
          teacherCategoryId: 'cat-1',
          teachingMode: TeachingMode.OFFLINE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(categoryRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects an inactive or unknown category', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createProfile('user-1', {
          teacherCategoryId: 'not-a-real-category',
          teachingMode: TeachingMode.OFFLINE,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a profile when the user has none yet and the category is valid', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      categoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Music Teacher',
      });
      profileRepo.create.mockImplementation((data) => data);
      profileRepo.save.mockImplementation((data) =>
        Promise.resolve({ id: 'new-profile', ...data }),
      );

      const result = await service.createProfile('user-1', {
        teacherCategoryId: 'cat-1',
        teachingMode: TeachingMode.BOTH,
        headline: 'Piano lessons',
      });

      expect(result.id).toBe('new-profile');
      expect(profileRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("rejects a caller who isn't the profile owner", async () => {
      profileRepo.findOne.mockResolvedValue({
        id: 'profile-1',
        user: { id: 'owner-user' },
      });

      await expect(
        service.update('profile-1', 'someone-else', { headline: 'Hacked' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(profileRepo.save).not.toHaveBeenCalled();
    });

    it('allows the owner to update their own profile', async () => {
      const existingProfile = {
        id: 'profile-1',
        user: { id: 'owner-user' },
        headline: 'Old',
      };
      profileRepo.findOne.mockResolvedValue(existingProfile);
      profileRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.update('profile-1', 'owner-user', {
        headline: 'New',
      });

      expect(result.headline).toBe('New');
    });
  });

  describe('listByInstitute', () => {
    const superAdmin = {
      userId: 'user-super',
      activeRole: 'super_admin',
      instituteId: null,
    } as const;
    const ownAdmin = {
      userId: 'user-admin',
      activeRole: 'institute_admin',
      instituteId: 'institute-1',
    } as const;
    const otherAdmin = {
      userId: 'user-other-admin',
      activeRole: 'institute_admin',
      instituteId: 'institute-2',
    } as const;

    it("rejects an institute_admin viewing another institute's roster", async () => {
      await expect(
        service.listByInstitute('institute-1', otherAdmin),
      ).rejects.toThrow(ForbiddenException);
      expect(profileRepo.find).not.toHaveBeenCalled();
    });

    it("returns the roster, shaped without passwordHash, for an institute_admin's own institute", async () => {
      profileRepo.find.mockResolvedValue([
        {
          id: 'profile-1',
          headline: 'Guitar teacher',
          verificationStatus: 'verified',
          payoutPercent: '30.00',
          user: {
            id: 'user-1',
            fullName: 'Jamie Lee',
            email: 'jamie@example.com',
          },
        },
      ]);

      const roster = await service.listByInstitute('institute-1', ownAdmin);

      expect(roster).toEqual([
        {
          id: 'profile-1',
          fullName: 'Jamie Lee',
          email: 'jamie@example.com',
          headline: 'Guitar teacher',
          verificationStatus: 'verified',
          payoutPercent: '30.00',
        },
      ]);
      expect(roster[0]).not.toHaveProperty('passwordHash');
    });

    it("allows super_admin to view any institute's roster", async () => {
      profileRepo.find.mockResolvedValue([]);
      await expect(
        service.listByInstitute('institute-2', superAdmin),
      ).resolves.toEqual([]);
    });
  });
});
