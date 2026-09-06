import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
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
});
