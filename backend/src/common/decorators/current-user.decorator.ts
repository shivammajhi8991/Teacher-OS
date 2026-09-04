import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/request-with-user.interface';

// Pulls the user JwtStrategy.validate() attached to the request — use in controllers instead of
// reaching into `@Req()` directly, so the shape (AuthenticatedUser) is enforced at the type level.
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
