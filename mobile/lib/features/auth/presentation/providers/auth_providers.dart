import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_token_storage.dart';
import '../../../../core/utils/result.dart';
import '../../data/datasources/auth_remote_data_source.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/usecases/login_usecase.dart';
import '../../domain/usecases/register_usecase.dart';
import 'auth_state.dart';

// docs/05 §5.2 — cross-feature state (current user, effectively) lives here in core-adjacent
// providers; only auth's own screens/notifier are feature-local, per the layering rule described
// in docs/05 §5.2 to avoid one sprawling global provider graph.

final secureTokenStorageProvider = Provider<SecureTokenStorage>((ref) => SecureTokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.watch(secureTokenStorageProvider);
  return ApiClient(
    tokenStorage: tokenStorage,
    // Read (not watch) — this closure runs later, on a 401 the refresh couldn't recover from,
    // not at provider-construction time, so there's no circular-init issue with authNotifierProvider.
    onUnauthenticated: () => ref.read(authNotifierProvider.notifier).forceLogoutLocally(),
  );
});

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  return AuthRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    remoteDataSource: ref.watch(authRemoteDataSourceProvider),
    tokenStorage: ref.watch(secureTokenStorageProvider),
  );
});

final loginUseCaseProvider = Provider((ref) => LoginUseCase(ref.watch(authRepositoryProvider)));
final registerUseCaseProvider =
    Provider((ref) => RegisterUseCase(ref.watch(authRepositoryProvider)));

/// docs/05 §5.3 — the router's redirect logic watches this. Login/register screens call
/// [login]/[register] directly (rather than going through go_router) so they can show a
/// field-level error from the returned [Result] without a redirect flashing in between.
class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    Future.microtask(_restoreSession);
    return const AuthUnknown();
  }

  Future<void> _restoreSession() async {
    final user = await ref.read(authRepositoryProvider).restoreSession();
    state = user != null ? AuthAuthenticated(user) : const AuthUnauthenticated();
  }

  Future<Result<AppUser>> login({required String identifier, required String password}) async {
    final result =
        await ref.read(loginUseCaseProvider).call(identifier: identifier, password: password);
    result.fold((_) {}, (user) => state = AuthAuthenticated(user));
    return result;
  }

  Future<Result<AppUser>> register({
    String? email,
    String? phone,
    required String password,
    required String fullName,
    required String role,
    String? preferredLanguage,
  }) async {
    final result = await ref.read(registerUseCaseProvider).call(
          email: email,
          phone: phone,
          password: password,
          fullName: fullName,
          role: role,
          preferredLanguage: preferredLanguage,
        );
    result.fold((_) {}, (user) => state = AuthAuthenticated(user));
    return result;
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthUnauthenticated();
  }

  /// Called by [ApiClient]'s AuthInterceptor when a 401 survives a refresh attempt — the session
  /// is dead server-side, so drop local state without another round trip.
  void forceLogoutLocally() {
    state = const AuthUnauthenticated();
  }
}

final authNotifierProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
