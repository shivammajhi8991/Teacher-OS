import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AppConfig } from '../../config/configuration';
import { parseDurationToMs } from './utils/duration.util';

const BCRYPT_COST = 12; // docs/02 §2.4

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email?: string;
  phone?: string;
  fullName: string;
  avatarUrl?: string;
  preferredLanguage: string;
  status: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; tokens: TokenPair }> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({
        code: 'EMAIL_OR_PHONE_REQUIRED',
        message: 'Provide at least an email or a phone number',
      });
    }

    const existing = dto.email
      ? await this.usersService.findByEmailOrPhone(dto.email)
      : await this.usersService.findByEmailOrPhone(dto.phone!);
    if (existing) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'An account with this email or phone already exists',
      });
    }

    const role = await this.usersService.findRoleByName(dto.role);
    if (!role) {
      // Seed migration didn't run, or an invalid role slipped past @IsIn — fail loudly either way.
      throw new BadRequestException({
        code: 'ROLE_NOT_SEEDED',
        message: `Role "${dto.role}" is not configured on this server`,
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      fullName: dto.fullName,
      preferredLanguage: dto.preferredLanguage ?? 'en',
    });
    await this.usersService.assignRole(user.id, role.id, null);

    const tokens = await this.issueTokenPair(
      user,
      role.name,
      null,
      dto.deviceId,
    );
    return { user: this.toPublicUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await this.usersService.findByEmailOrPhone(dto.identifier);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      // Same error for "no such user" and "wrong password" — never reveal which one (docs/04 §4.8).
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect email/phone or password',
      });
    }

    const userRoles = await this.usersService.getUserRoles(user.id);
    if (userRoles.length === 0) {
      throw new UnauthorizedException({
        code: 'NO_ROLE_ASSIGNED',
        message: 'This account has no role assigned — contact support',
      });
    }
    // docs/04 §4.3 switch-role handles picking a different one for users with multiple roles.
    const active = userRoles[0];

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokenPair(
      user,
      active.role.name,
      active.institute?.id ?? null,
      dto.deviceId,
    );
    return { user: this.toPublicUser(user), tokens };
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenPair> {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    let payload: {
      sub: string;
      role: string;
      instituteId: string | null;
      deviceId: string;
    };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    const tokenHash = this.hashToken(dto.refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: {
        tokenHash,
        deviceId: dto.deviceId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });
    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token has been revoked or reused',
      });
    }

    // Rotation: the presented token is single-use — revoke it, issue a fresh pair.
    // docs/03 §3.2 refresh_tokens — a reuse of an already-rotated token is a signal of theft;
    // production hardening (Phase 6) revokes the whole family on reuse detection.
    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    return this.issueTokenPair(
      stored.user,
      payload.role,
      payload.instituteId,
      dto.deviceId,
    );
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { user: { id: userId }, deviceId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { user: { id: userId }, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async me(userId: string, instituteId: string | null) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    const roles = await this.usersService.getUserRoles(userId);
    const permissions = await this.usersService.getEffectivePermissions(
      userId,
      instituteId,
    );
    return {
      user: this.toPublicUser(user),
      roles: roles.map((r) => ({
        role: r.role.name,
        instituteId: r.institute?.id ?? null,
      })),
      permissions: Array.from(permissions),
    };
  }

  private async issueTokenPair(
    user: User,
    role: string,
    instituteId: string | null,
    deviceId: string,
  ): Promise<TokenPair> {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    const commonPayload = { sub: user.id, role, instituteId, deviceId };

    const accessToken = await this.jwtService.signAsync(commonPayload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessExpiresIn,
    });
    // `jti` — without it, two refresh tokens issued for the same user/role/institute/device
    // within the same wall-clock second (iat has 1-second resolution) sign to the byte-identical
    // JWT string. That collision isn't hypothetical: it's exactly what let a rotated-out refresh
    // token pass as "still valid" in practice — the just-issued replacement shared its hash, so
    // the reuse check matched the new row instead of correctly finding the old one revoked. Real
    // uniqueness per issuance is what a rotation scheme's reuse detection actually depends on.
    const refreshToken = await this.jwtService.signAsync(
      { ...commonPayload, jti: randomUUID() },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      },
    );

    const expiresAt = new Date(
      Date.now() + parseDurationToMs(jwtConfig.refreshExpiresIn),
    );
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        user,
        tokenHash: this.hashToken(refreshToken),
        deviceId,
        expiresAt,
      }),
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    // Refresh tokens are already high-entropy signed JWTs — a fast hash is fine here (this is a
    // lookup key, not a password), unlike passwordHash above which uses bcrypt.
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: User): PublicUser {
    // Explicit allowlist, never spread(user) — docs/04 §4.8: passwordHash must never leave here.
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      preferredLanguage: user.preferredLanguage,
      status: user.status,
    };
  }
}
