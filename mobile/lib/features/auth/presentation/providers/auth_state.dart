import '../../domain/entities/app_user.dart';

/// docs/05 §5.3 — the router's redirect logic switches on this. [AuthUnknown] (session restore
/// still in flight) intentionally does NOT redirect to /login, so a returning user with a valid
/// stored token doesn't flash the login screen on cold start.
sealed class AuthState {
  const AuthState();
}

final class AuthUnknown extends AuthState {
  const AuthUnknown();
}

final class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

final class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final AppUser user;
}
