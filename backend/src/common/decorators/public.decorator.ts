import { SetMetadata } from '@nestjs/common';

// JwtAuthGuard is applied globally (see app.module.ts APP_GUARD) so a route is protected by
// default and has to opt OUT with @Public() — safer than opt-in, since a forgotten guard on a
// new controller silently exposes it rather than silently protecting it.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
