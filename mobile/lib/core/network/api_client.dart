import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../storage/secure_token_storage.dart';
import 'auth_interceptor.dart';

/// One Dio instance for the whole app (docs/02 §2.6/§2.7 conventions: /api/v1 base path,
/// idempotency headers added per-call by whichever feature needs them — docs/04 §4.2).
class ApiClient {
  ApiClient({required SecureTokenStorage tokenStorage, void Function()? onUnauthenticated}) {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: AppConstants.apiConnectTimeout,
        receiveTimeout: AppConstants.apiReceiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );
    dio.interceptors.add(
      AuthInterceptor(
        dio: dio,
        tokenStorage: tokenStorage,
        baseUrl: AppConstants.apiBaseUrl,
        onUnauthenticated: onUnauthenticated ?? () {},
      ),
    );
  }

  late final Dio dio;
}
