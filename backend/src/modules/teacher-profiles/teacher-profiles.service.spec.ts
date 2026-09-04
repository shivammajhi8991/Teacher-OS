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
});
