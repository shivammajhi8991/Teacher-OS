import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/students_providers.dart';

/// docs/07 roadmap Phase 5 step 3 "Parent dashboard." `GET /students` scopes to a parent's own
/// linked children automatically (StudentsService.findAll's parent branch) — the exact same
/// use case the Teacher dashboard's Students tab already calls, reused as-is here since the
/// backend, not the client, decides what "the student list" means for the caller's role.
final linkedChildrenProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(listStudentsUseCaseProvider).call();
});

/// `null` until the parent explicitly picks a child in the switcher — see [effectiveChildId],
/// which falls back to the first linked child rather than requiring an explicit pick when there
/// is only one (or none yet made among several).
final selectedChildIdProvider = StateProvider<String?>((ref) => null);

String? effectiveChildId(List<Student> children, String? explicitlySelected) {
  if (explicitlySelected != null && children.any((c) => c.id == explicitlySelected)) {
    return explicitlySelected;
  }
  return children.isEmpty ? null : children.first.id;
}
