import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeacherCategoryAdminService } from './teacher-category-admin.service';
import { TeacherCategory } from './entities/teacher-category.entity';

describe('TeacherCategoryAdminService', () => {
  let service: TeacherCategoryAdminService;
  const categoryRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'category-1', ...d })),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TeacherCategoryAdminService,
        {
          provide: getRepositoryToken(TeacherCategory),
          useValue: categoryRepo,
        },
      ],
    }).compile();
    service = module.get(TeacherCategoryAdminService);
  });

  describe('create', () => {
    it('slugifies the name', async () => {
      categoryRepo.findOne.mockResolvedValue(null); // slug not taken
      const category = await service.create({ name: 'Robotics Coach' });
      expect(category.slug).toBe('robotics-coach');
      expect(category.isActive).toBe(true);
    });

    it('appends a numeric suffix when the slug is already taken', async () => {
      categoryRepo.findOne
        .mockResolvedValueOnce({ id: 'existing', slug: 'music-teacher' }) // first candidate taken
        .mockResolvedValueOnce(null); // second candidate free
      const category = await service.create({ name: 'Music Teacher' });
      expect(category.slug).toBe('music-teacher-2');
    });
  });

  describe('update', () => {
    it('404s for a nonexistent category', async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('merges only the provided fields, leaving the rest untouched', async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: 'category-1',
        name: 'Old Name',
        icon: 'old-icon',
        defaultFeeModel: null,
        isActive: true,
      });
      const updated = await service.update('category-1', { isActive: false });
      expect(updated.name).toBe('Old Name');
      expect(updated.icon).toBe('old-icon');
      expect(updated.isActive).toBe(false);
    });
  });
});
