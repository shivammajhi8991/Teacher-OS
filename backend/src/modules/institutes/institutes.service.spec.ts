import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstitutesService } from './institutes.service';
import { Institute } from './entities/institute.entity';
import { Branch } from './entities/branch.entity';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/06 §6.2 "Institution management ... F (own institute)" for institute_admin vs. an
// unrestricted grant for super_admin — the resource-level scoping this controller's own comment
// used to flag as an unfixed follow-up (see institutes.service.ts's header comment on `create`).
describe('InstitutesService', () => {
  let service: InstitutesService;
  const instituteRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'institute-1', ...d })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
  const branchRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'branch-1', ...d })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InstitutesService,
        { provide: getRepositoryToken(Institute), useValue: instituteRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
      ],
    }).compile();
    service = module.get(InstitutesService);
  });

  describe('create', () => {
    it('rejects an institute_admin — creating a new institute is super_admin only', () => {
      // `create` throws synchronously (no await before the check) rather than returning a
      // rejected promise, so the assertion wraps the call instead of using `.rejects`.
      expect(() => service.create(ownAdmin, { name: 'New Institute' })).toThrow(
        ForbiddenException,
      );
      expect(instituteRepo.save).not.toHaveBeenCalled();
    });

    it('allows super_admin to create a new institute', async () => {
      await service.create(superAdmin, { name: 'New Institute' });
      expect(instituteRepo.save).toHaveBeenCalled();
    });
  });

  describe('update / archive', () => {
    beforeEach(() => {
      instituteRepo.findOne.mockResolvedValue({
        id: 'institute-1',
        name: 'Institute 1',
      });
    });

    it('rejects an institute_admin updating another institute', async () => {
      await expect(
        service.update('institute-1', otherAdmin, { name: 'Renamed' }),
      ).rejects.toThrow(ForbiddenException);
      expect(instituteRepo.update).not.toHaveBeenCalled();
    });

    it('allows an institute_admin to update their own institute', async () => {
      await service.update('institute-1', ownAdmin, { name: 'Renamed' });
      expect(instituteRepo.update).toHaveBeenCalledWith('institute-1', {
        name: 'Renamed',
      });
    });

    it('rejects an institute_admin archiving another institute', async () => {
      await expect(service.archive('institute-1', otherAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(instituteRepo.softDelete).not.toHaveBeenCalled();
    });

    it('allows super_admin to archive any institute', async () => {
      await service.archive('institute-1', superAdmin);
      expect(instituteRepo.softDelete).toHaveBeenCalledWith('institute-1');
    });
  });

  describe('branches', () => {
    beforeEach(() => {
      instituteRepo.findOne.mockResolvedValue({
        id: 'institute-1',
        name: 'Institute 1',
      });
      branchRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        institute: { id: 'institute-1' },
      });
    });

    it("rejects creating a branch under another admin's institute", async () => {
      await expect(
        service.createBranch('institute-1', otherAdmin, { name: 'North Wing' }),
      ).rejects.toThrow(ForbiddenException);
      expect(branchRepo.save).not.toHaveBeenCalled();
    });

    it('allows an institute_admin to create a branch of their own institute', async () => {
      await service.createBranch('institute-1', ownAdmin, {
        name: 'North Wing',
      });
      expect(branchRepo.save).toHaveBeenCalled();
    });

    it("rejects archiving a branch belonging to another admin's institute", async () => {
      await expect(
        service.archiveBranch('branch-1', otherAdmin),
      ).rejects.toThrow(ForbiddenException);
      expect(branchRepo.softDelete).not.toHaveBeenCalled();
    });

    it('allows an institute_admin to archive a branch of their own institute', async () => {
      await service.archiveBranch('branch-1', ownAdmin);
      expect(branchRepo.softDelete).toHaveBeenCalledWith('branch-1');
    });
  });
});
