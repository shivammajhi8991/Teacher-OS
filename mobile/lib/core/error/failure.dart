/// Domain-layer error type — repositories return `Failure` (never throw a raw DioException) so
/// the presentation layer never needs to know about Dio. docs/04 §4.1's error envelope
/// ({error: {code, message, details}}) maps directly onto `code`/`message` here.
sealed class Failure {
  const Failure({required this.message, this.code});

  final String message;
  final String? code;
}

/// No connectivity, timeout, or the server unreachable — the case where cached/local data
/// (docs/05 §5.4) should still be shown rather than a blocking error screen.
final class NetworkFailure extends Failure {
  const NetworkFailure({super.message = 'Network error', super.code});
}

/// A well-formed error response from the API (docs/04 §4.1 envelope) — `code` is the stable
/// machine-readable string the UI can switch on for localized messages.
final class ApiFailure extends Failure {
  const ApiFailure({required super.message, required super.code, this.statusCode});

  final int? statusCode;
}

/// Local form/input validation failed before a request was even sent.
final class ValidationFailure extends Failure {
  const ValidationFailure({required super.message, this.fieldErrors = const {}});

  final Map<String, String> fieldErrors;
}

/// Anything else — deliberately named so it's never mistaken for a handled case.
final class UnexpectedFailure extends Failure {
  const UnexpectedFailure({super.message = 'Something went wrong', super.code});
}
