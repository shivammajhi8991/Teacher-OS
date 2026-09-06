import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminUsersService } from './admin-users.service';
import { User, UserStatus } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { RoleName } from './entities/role.entity';
import { UsersService } from './users.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// A chainable QueryBuilder stub — every method returns `this` except the terminal `getMany()`,
// matching the subset of TypeORM's real QueryBuilder API `AdminUsersService.search` actually
// calls.
function createQueryBuilderStub(result: User[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = ['leftJoinAndSelect', 'andWhere', 'orderBy'];
  for (const method of chain) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.subQuery = jest.fn().mockReturnValue(qb);
  qb.select = jest.fn().mockReturnValue(qb);
  qb.from = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.getQuery = jest.fn().mockReturnValue('SELECT 1');
  qb.getMany = jest.fn().mockResolvedValue(result);
  return qb;
}

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  const userRepo = { createQueryBuilder: jest.fn(), update: jest.fn() };
  const userRoleRepo = { findOne: jest.fn() };
  const usersService = { findRoleByName: jest.fn(), assignRole: jest.fn() };

  const superAdmin: AuthenticatedUser = {
    userId: 'user-super',
    activeRole: 'super_admin',
    instituteId: null,
  };
  const instituteAdmin: AuthenticatedUser = {
    userId: 'user-admin',
    activeRole: 'institute_admin',
    instituteId: 'institute-1',
  };
  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    service = module.get(AdminUsersService);
  });

  describe('search', () => {
    it('rejects a caller with no institute-admin scope at all', async () => {
      await expect(service.search(teacher, {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('lets super_admin search unscoped', async () => {
      const qb = createQueryBuilderStub([]);
      userRepo.createQueryBuilder.mockReturnValue(qb);
      await service.search(superAdmin, {});
      // No institute-scoping subquery clause added for super_admin.
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.any(Function),
        expect.anything(),
      );
    });

    it("scopes an institute_admin's search to their own institute", async () => {
      const qb = createQueryBuilderStub([]);
      userRepo.createQueryBuilder.mockReturnValue(qb);
      await service.search(instituteAdmin, {});
      expect(qb.andWhere).toHaveBeenCalledWith(expect.any(Function), {
        instituteId: 'institute-1',
      });
    });
  });

  describe('updateStatus', () => {
    it('rejects an institute_admin updating a user outside their institute', async () => {
      userRoleRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('user-1', instituteAdmin, {
          status: UserStatus.SUSPENDED,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('allows super_admin to update any user unconditionally', async () => {
      await service.updateStatus('user-1', superAdmin, {
        status: UserStatus.SUSPENDED,
      });
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        status: UserStatus.SUSPENDED,
      });
    });

    it('allows an institute_admin to update a user within their institute', async () => {
      userRoleRepo.findOne.mockResolvedValue({ id: 'user-role-1' });
      await service.updateStatus('user-1', instituteAdmin, {
        status: UserStatus.ACTIVE,
      });
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        status: UserStatus.ACTIVE,
      });
    });
  });

  describe('assignRole', () => {
    it('rejects an institute_admin granting super_admin', async () => {
      await expect(
        service.assignRole('user-1', instituteAdmin, {
          role: RoleName.SUPER_ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(usersService.assignRole).not.toHaveBeenCalled();
    });

    it('rejects an institute_admin granting a role for a different institute', async () => {
      await expect(
        service.assignRole('user-1', instituteAdmin, {
          role: RoleName.TEACHER,
          instituteId: 'institute-2',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an institute_admin to grant a role scoped to their own institute', async () => {
      userRoleRepo.findOne.mockResolvedValue({ id: 'user-role-1' });
      usersService.findRoleByName.mockResolvedValue({ id: 'role-1' });
      await service.assignRole('user-1', instituteAdmin, {
        role: RoleName.TEACHER,
        instituteId: 'institute-1',
      });
      expect(usersService.assignRole).toHaveBeenCalledWith(
        'user-1',
        'role-1',
        'institute-1',
      );
    });

    it('404s for an unknown role name resolution failure', async () => {
      usersService.findRoleByName.mockResolvedValue(null);
      await expect(
        service.assignRole('user-1', superAdmin, { role: RoleName.TEACHER }),
      ).rejects.toThrow(NotFoundException);
    });

    it('reports a duplicate (user, role, institute) grant as a conflict, not a raw DB error', async () => {
      usersService.findRoleByName.mockResolvedValue({ id: 'role-1' });
      usersService.assignRole.mockRejectedValue({ code: '23505' });
      await expect(
        service.assignRole('user-1', superAdmin, { role: RoleName.TEACHER }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
