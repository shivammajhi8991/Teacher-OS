import { SetMetadata } from '@nestjs/common';

// docs/04 §4.5 — mirrors the backend PermissionsGuard's job: declare the permission a route
// needs, e.g. @RequirePermission('attendance.mark'). See docs/06-roles-permissions.md for the
// full catalogue of permission keys.
export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
