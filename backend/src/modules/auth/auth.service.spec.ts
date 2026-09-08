import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { Guardian } from '../students/entities/guardian.entity';
import { UsersService } from '../users/users.service';
import { RoleName } from '../users/entities/role.entity';

// docs/03 §3.4 guardians.user_id — the interesting logic added here is register()'s
// guardian-linking side effect: a freshly-registered parent account should pick up any
// already-existing Guardian row sharing their email/phone, and — just as importantly — every
// other registration (teacher/student) must never touch Guardian rows at all.
describe('AuthService', () => {
  let service: AuthService;
  const refreshTokenRepo = {
    save: jest.fn((d) => Promise.resolve(d)),
    create: jest.fn((d) => d),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
  };
  const guardianRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const usersService = {
    findByEmailOrPhone: jest.fn().mockResolvedValue(null),
    createUser: jest.fn(),
    findRoleByName: jest.fn(),
    assignRole: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    getUserRoles: jest.fn().mockResolvedValue([]),
    getEffectivePermissions: jest.fn().mockResolvedValue(new Set()),
    softDeleteUser: jest.fn().mockResolvedValue(undefined),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
  };
  const jwtConfig = {
    accessSecret: 'access-secret',
    accessExpiresIn: '15m',
    refreshSecret: 'refresh-secret',
    refreshExpiresIn: '30d',
  };
  const configService = { get: jest.fn().mockReturnValue(jwtConfig) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepo,
        },
        { provide: getRepositoryToken(Guardian), useValue: guardianRepo },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);

    // Safe, explicit defaults — jest.clearAllMocks() drops call history but not a mock's
    // last-set resolved value, so every test below only overrides what it actually needs.
    usersService.findByEmailOrPhone.mockResolvedValue(null);
    usersService.createUser.mockResolvedValue({
      id: 'user-1',
      email: 'parent@example.com',
      fullName: 'A Parent',
      preferredLanguage: 'en',
      status: 'active',
    });
    configService.get.mockReturnValue(jwtConfig);
    guardianRepo.find.mockResolvedValue([]);
  });

  describe('register', () => {
    it('rejects when neither email nor phone is given', async () => {
      await expect(
        service.register({
          password: 'correct-horse-battery-staple',
          fullName: 'Nobody',
          role: RoleName.TEACHER,
          deviceId: 'device-1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate email', async () => {
      usersService.findByEmailOrPhone.mockResolvedValue({
        id: 'existing-user',
      });
      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'correct-horse-battery-staple',
          fullName: 'Someone',
          role: RoleName.TEACHER,
          deviceId: 'device-1',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("links every unlinked Guardian row sharing the new parent's email to their new account", async () => {
      usersService.findRoleByName.mockResolvedValue({
        id: 'role-parent',
        name: 'parent',
      });
      const unlinkedGuardian = {
        id: 'guardian-1',
        email: 'parent@example.com',
        user: null,
      };
      guardianRepo.find.mockResolvedValue([unlinkedGuardian]);

      await service.register({
        email: 'parent@example.com',
        password: 'correct-horse-battery-staple',
        fullName: 'A Parent',
        role: RoleName.PARENT,
        deviceId: 'device-1',
      } as any);

      expect(guardianRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ email: 'parent@example.com' }),
          ]),
        }),
      );
      expect(guardianRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'guardian-1',
          user: expect.objectContaining({ id: 'user-1' }),
        }),
      );
    });

    it('never queries or touches Guardian rows for a non-parent registration', async () => {
      usersService.findRoleByName.mockResolvedValue({
        id: 'role-teacher',
        name: 'teacher',
      });

      await service.register({
        email: 'teacher@example.com',
        password: 'correct-horse-battery-staple',
        fullName: 'A Teacher',
        role: RoleName.TEACHER,
        deviceId: 'device-1',
      } as any);

      expect(guardianRepo.find).not.toHaveBeenCalled();
      expect(guardianRepo.save).not.toHaveBeenCalled();
    });

    it('registering as a parent with no matching guardian record is a safe no-op, not an error', async () => {
      usersService.findRoleByName.mockResolvedValue({
        id: 'role-parent',
        name: 'parent',
      });
      guardianRepo.find.mockResolvedValue([]);

      const result = await service.register({
        email: 'newparent@example.com',
        password: 'correct-horse-battery-staple',
        fullName: 'New Parent',
        role: RoleName.PARENT,
        deviceId: 'device-1',
      } as any);

      expect(guardianRepo.save).not.toHaveBeenCalled();
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
    });
  });

  // docs/01 §1.3 "account deletion request flow" — Phase 6.
  describe('deleteAccount', () => {
    it('rejects the wrong password without touching any session or the user row', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: await bcrypt.hash('correct-horse-battery-staple', 4),
      });

      await expect(
        service.deleteAccount('user-1', 'totally-wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenRepo.update).not.toHaveBeenCalled();
      expect(usersService.softDeleteUser).not.toHaveBeenCalled();
    });

    it('rejects deleting an account that does not exist, same as a wrong password', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.deleteAccount('missing-user', 'anything'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('revokes every session then soft-deletes the user on a correct password', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: await bcrypt.hash('correct-horse-battery-staple', 4),
      });

      await service.deleteAccount('user-1', 'correct-horse-battery-staple');

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ user: { id: 'user-1' } }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(usersService.softDeleteUser).toHaveBeenCalledWith('user-1');
    });
  });

  // docs/01 §1.3 "data export... flow" — Phase 6.
  describe('exportAccountData', () => {
    it('scopes the export to identity/access data and names what it deliberately omits', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        email: 'teacher@example.com',
        fullName: 'A Teacher',
        preferredLanguage: 'en',
        status: 'active',
      });
      usersService.getUserRoles.mockResolvedValue([
        { role: { name: 'teacher' }, institute: null },
      ]);
      refreshTokenRepo.find.mockResolvedValue([
        { deviceId: 'device-1', createdAt: new Date(), expiresAt: new Date() },
      ]);

      const result = await service.exportAccountData('user-1', null);

      expect(result.account.email).toBe('teacher@example.com');
      expect(result.roles).toEqual([{ role: 'teacher', instituteId: null }]);
      expect(result.activeSessions).toHaveLength(1);
      expect(result.scopeNote).toMatch(/does not yet/);
      // Only active (non-revoked) sessions — logoutAll's own filter, reused here.
      expect(refreshTokenRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user: { id: 'user-1' } }),
        }),
      );
    });
  });
});
