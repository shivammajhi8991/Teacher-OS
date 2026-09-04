import 'package:dio/dio.dart';
import '../storage/secure_token_storage.dart';

/// docs/02 §2.4 — attaches the access token to every request, and on a 401 attempts exactly one
/// token refresh (de-duplicated across concurrently-failing requests via [_refreshFuture]) before
/// retrying the original call once. A second 401 after that, or a failed refresh, calls
/// [onUnauthenticated] so the app can drop back to the login screen (docs/05 §5.3 router redirect)
/// rather than looping forever.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required Dio dio,
    required SecureTokenStorage tokenStorage,
    required String baseUrl,
    required void Function() onUnauthenticated,
  })  : _dio = dio,
        _tokenStorage = tokenStorage,
        _baseUrl = baseUrl,
        _onUnauthenticated = onUnauthenticated;

  final Dio _dio;
  final SecureTokenStorage _tokenStorage;
  final String _baseUrl;
  final void Function() _onUnauthenticated;

  Future<String?>? _refreshFuture;

  static const _retriedFlag = 'teacheros_retried';

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _tokenStorage.readAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final isUnauthorized = err.response?.statusCode == 401;
    final alreadyRetried = err.requestOptions.extra[_retriedFlag] == true;
    final isAuthEndpoint = err.requestOptions.path.contains('/auth/login') ||
        err.requestOptions.path.contains('/auth/register') ||
        err.requestOptions.path.contains('/auth/refresh');

    if (!isUnauthorized || alreadyRetried || isAuthEndpoint) {
      handler.next(err);
      return;
    }

    final newAccessToken = await _refreshAccessToken();
    if (newAccessToken == null) {
      await _tokenStorage.clearTokens();
      _onUnauthenticated();
      handler.next(err);
      return;
    }

    try {
      final retryOptions = err.requestOptions;
      retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';
      retryOptions.extra[_retriedFlag] = true;
      final response = await _dio.fetch(retryOptions);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  /// De-duplicates concurrent refresh attempts: if three requests 401 at once, only one
  /// `/auth/refresh` call is made and all three await the same result.
  Future<String?> _refreshAccessToken() {
    return _refreshFuture ??= _doRefresh().whenComplete(() => _refreshFuture = null);
  }

  Future<String?> _doRefresh() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    final deviceId = await _tokenStorage.readOrCreateDeviceId();
    if (refreshToken == null) return null;

    try {
      // A bare Dio instance, not `_dio` — avoids recursing through this same interceptor.
      final response = await Dio().post(
        '$_baseUrl/auth/refresh',
        data: {'refreshToken': refreshToken, 'deviceId': deviceId},
      );
      final newAccessToken = response.data['accessToken'] as String;
      final newRefreshToken = response.data['refreshToken'] as String;
      await _tokenStorage.saveTokens(accessToken: newAccessToken, refreshToken: newRefreshToken);
      return newAccessToken;
    } on DioException {
      return null;
    }
  }
}
