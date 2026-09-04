import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/presentation/providers/auth_providers.dart';
import '../features/auth/presentation/providers/auth_state.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/register_screen.dart';
import '../features/dashboard/presentation/screens/institute_admin_dashboard_screen.dart';
import '../features/dashboard/presentation/screens/parent_dashboard_screen.dart';
import '../features/dashboard/presentation/screens/student_dashboard_screen.dart';
import '../features/dashboard/presentation/screens/teacher_dashboard_screen.dart';

/// docs/05 §5.3 — protected-by-default: every route not explicitly public redirects to /login
/// when [AuthState] is [AuthUnauthenticated]. [AuthUnknown] (session restore in flight) holds
/// position rather than redirecting, so a returning user doesn't flash the login screen.
///
/// Rebuilding the whole router on every auth-state change (via `ref.watch` below) is the simple,
/// obviously-correct choice for this scaffold's route count; a `refreshListenable` bridge is the
/// usual optimization if/once the route table grows large enough for it to matter.
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authNotifierProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final loggingIn = state.matchedLocation == '/login' || state.matchedLocation == '/register';

      if (authState is AuthUnknown) return null; // hold position until session restore resolves

      if (authState is AuthUnauthenticated) {
        return loggingIn ? null : '/login';
      }

      // Authenticated: bounce away from /login, /register, and the role-agnostic '/' splash.
      if (authState is AuthAuthenticated) {
        if (loggingIn || state.matchedLocation == '/') {
          return _landingRouteFor(authState.user.activeRole);
        }
      }
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const _SplashPlaceholder()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(path: '/teacher', builder: (context, state) => const TeacherDashboardScreen()),
      GoRoute(path: '/student', builder: (context, state) => const StudentDashboardScreen()),
      GoRoute(path: '/parent', builder: (context, state) => const ParentDashboardScreen()),
      GoRoute(
        path: '/admin',
        builder: (context, state) => const InstituteAdminDashboardScreen(),
      ),
    ],
  );
});

String _landingRouteFor(String role) => switch (role) {
      'teacher' => '/teacher',
      'student' => '/student',
      'parent' => '/parent',
      'institute_admin' || 'super_admin' => '/admin',
      _ => '/login',
    };

/// Rendered only for the instant between app start and the redirect resolving.
class _SplashPlaceholder extends StatelessWidget {
  const _SplashPlaceholder();

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: CircularProgressIndicator()));
}
