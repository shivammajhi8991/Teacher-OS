// What JwtStrategy.validate() attaches to `request.user`. Deliberately minimal — the JWT itself
// (docs/02 §2.4) carries only userId + activeRole; permissions are resolved fresh per-request
// (see PermissionsGuard) so a permission revocation takes effect immediately, not at token expiry.
export interface AuthenticatedUser {
  userId: string;
  activeRole: string;
  instituteId: string | null;
}
