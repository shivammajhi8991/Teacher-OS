import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../config/configuration';
import { AuthenticatedUser } from '../../../common/interfaces/request-with-user.interface';

interface AccessTokenPayload {
  sub: string; // user id
  role: string; // active role at time of login/switch-role (docs/04 §4.3 switch-role)
  instituteId: string | null;
}

// docs/02 §2.4 — validates the short-lived access token on every protected request.
// Permissions are NOT in the payload (see request-with-user.interface.ts) — PermissionsGuard
// resolves those fresh per-request so a revocation takes effect immediately.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).accessSecret,
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      activeRole: payload.role,
      instituteId: payload.instituteId,
    };
  }
}
