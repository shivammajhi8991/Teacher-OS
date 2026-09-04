import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/storage/secure_token_storage.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';
import '../dto/me_response_dto.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthRemoteDataSource remoteDataSource,
    required SecureTokenStorage tokenStorage,
  })  : _remoteDataSource = remoteDataSource,
        _tokenStorage = tokenStorage;

  final AuthRemoteDataSource _remoteDataSource;
  final SecureTokenStorage _tokenStorage;

  @override
  Future<Result<AppUser>> login({required String identifier, required String password}) async {
    try {
      final deviceId = await _tokenStorage.readOrCreateDeviceId();
      final loginResponse = await _remoteDataSource.login(
        identifier: identifier,
        password: password,
        deviceId: deviceId,
      );
      await _saveTokensFrom(loginResponse);
      return Ok(await _fetchCurrentUser());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<AppUser>> register({
    String? email,
    String? phone,
    required String password,
    required String fullName,
    required String role,
    String? preferredLanguage,
  }) async {
    try {
      final deviceId = await _tokenStorage.readOrCreateDeviceId();
      final registerResponse = await _remoteDataSource.register(
        email: email,
        phone: phone,
        password: password,
        fullName: fullName,
        role: role,
        preferredLanguage: preferredLanguage,
        deviceId: deviceId,
      );
      await _saveTokensFrom(registerResponse);
      return Ok(await _fetchCurrentUser());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> logout() async {
    try {
      final deviceId = await _tokenStorage.readOrCreateDeviceId();
      await _remoteDataSource.logout(deviceId);
    } on DioException {
      // docs/01 §1.5-style leniency: a failed logout call server-side must never trap the user
      // signed in on their own device — clear local tokens regardless and let the server-side
      // refresh token simply expire naturally.
    } finally {
      await _tokenStorage.clearTokens();
    }
    return const Ok(null);
  }

  @override
  Future<AppUser?> restoreSession() async {
    final accessToken = await _tokenStorage.readAccessToken();
    if (accessToken == null) return null;
    try {
      return await _fetchCurrentUser();
    } on DioException {
      // Expired/invalid — AuthInterceptor already tried a refresh internally; if we're still
      // here, there's no valid session to restore.
      await _tokenStorage.clearTokens();
      return null;
    }
  }

  Future<void> _saveTokensFrom(Map<String, dynamic> response) async {
    final tokens = response['tokens'] as Map<String, dynamic>;
    await _tokenStorage.saveTokens(
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
  }

  Future<AppUser> _fetchCurrentUser() async {
    final meJson = await _remoteDataSource.me();
    return MeResponseDto.fromJson(meJson).toEntity();
  }
}
