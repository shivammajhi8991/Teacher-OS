import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { UsersService } from '../../modules/users/users.service';
import { AuthenticatedUser } from '../interfaces/request-with-user.interface';

// docs/04 §4.5, docs/06 §6.4 — layer 1 of defense-in-depth (layer 2 is Flutter's route guards,
// docs/05 §5.3, which is UX-only and never trusted as the security boundary).
//
// NOTE: this checks role-level permission only. Resource-level scoping (e.g. "this teacher owns
// THIS class") is each module's own responsibility, checked in the service/controller after this
// guard passes — see docs/04 §4.5 for why both layers are required.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true; // route didn't declare @RequirePermission — JwtAuthGuard alone applies
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    const effectivePermissions =
      await this.usersService.getEffectivePermissions(
        user.userId,
        user.instituteId,
      );

    const hasAll = required.every((p) => effectivePermissions.has(p));
    if (!hasAll) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: `Missing required permission: ${required.join(', ')}`,
      });
    }
    return true;
  }
}
