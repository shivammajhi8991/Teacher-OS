/// Build-time config — passed via `--dart-define`, never hardcoded per-environment.
/// docs/02 §2.9 environments: dev / staging / production each point at a different API.
class AppConstants {
  const AppConstants._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );

  static const Duration apiConnectTimeout = Duration(seconds: 10);
  static const Duration apiReceiveTimeout = Duration(seconds: 15);
}
