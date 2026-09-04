import '../error/failure.dart';

/// Minimal Result type so repositories return failures as data instead of throwing across layer
/// boundaries (docs/05 §5.1) — deliberately hand-rolled rather than pulling in a functional-
/// programming package, to keep this scaffold dependency-light and its API obvious at a glance.
sealed class Result<T> {
  const Result();

  R fold<R>(R Function(Failure failure) onFailure, R Function(T value) onSuccess) {
    final self = this;
    return switch (self) {
      Ok<T>() => onSuccess(self.value),
      Err<T>() => onFailure(self.failure),
    };
  }

  bool get isSuccess => this is Ok<T>;
}

final class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

final class Err<T> extends Result<T> {
  const Err(this.failure);
  final Failure failure;
}
