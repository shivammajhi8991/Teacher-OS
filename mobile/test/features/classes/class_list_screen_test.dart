import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/classes/domain/entities/class_schedule.dart';
import 'package:teacheros/features/classes/domain/entities/enrollment_summary.dart';
import 'package:teacheros/features/classes/domain/entities/schedule_conflict.dart';
import 'package:teacheros/features/classes/domain/entities/teaching_class.dart';
import 'package:teacheros/features/classes/domain/repositories/classes_repository.dart';
import 'package:teacheros/features/classes/presentation/providers/classes_providers.dart';
import 'package:teacheros/features/classes/presentation/screens/class_list_screen.dart';

class _FakeClassesRepository implements ClassesRepository {
  _FakeClassesRepository(this._classes);
  final List<TeachingClass> _classes;

  @override
  Future<Result<List<TeachingClass>>> listClasses({String? status}) async => Ok(_classes);

  @override
  Future<Result<TeachingClass>> createClass({
    required String name,
    String? subjectOrActivity,
    String? classType,
    required String mode,
    String? locationOrMeetingLink,
    int? capacityMax,
    required String startDate,
    String? endDate,
  }) =>
      throw UnimplementedError();

  @override
  Future<Result<TeachingClass>> getClass(String id) => throw UnimplementedError();

  @override
  Future<Result<TeachingClass>> updateClass(String id, {String? name, String? subjectOrActivity, String? mode, String? locationOrMeetingLink, int? capacityMax, String? endDate, String? status}) =>
      throw UnimplementedError();

  @override
  Future<Result<ClassSchedule?>> getSchedule(String classId) => throw UnimplementedError();

  @override
  Future<Result<ClassSchedule>> setSchedule(String classId, {required String effectiveFrom, required String recurrenceRule, required String startTime, required String endTime, String? timezone}) =>
      throw UnimplementedError();

  @override
  Future<Result<List<ScheduleConflict>>> getConflicts(String classId) => throw UnimplementedError();

  @override
  Future<Result<List<EnrollmentSummary>>> getEnrollments(String classId) => throw UnimplementedError();

  @override
  Future<Result<EnrollmentSummary>> enrollStudent(String classId, String studentId, {String? enrollmentType}) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> addToWaitlist(String classId, String studentId) => throw UnimplementedError();
}

// docs/05 §5.7 — widget test for Classes' primary screen, mirroring the Students list test.
void main() {
  testWidgets('shows the empty state with a Create Class CTA when there are no classes', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [classesRepositoryProvider.overrideWithValue(_FakeClassesRepository(const []))],
        child: const MaterialApp(home: ClassListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('No classes yet — create your first class to start taking attendance.'),
      findsOneWidget,
    );
    expect(find.widgetWithText(FilledButton, 'Create Class'), findsOneWidget);
  });

  testWidgets('renders a tile per class when the list is populated', (tester) async {
    const classes = [
      TeachingClass(
        id: '1',
        name: 'Guitar Batch A',
        classType: 'recurring',
        mode: 'offline',
        startDate: '2026-01-05',
        status: 'active',
      ),
      TeachingClass(
        id: '2',
        name: 'Piano Basics',
        classType: 'recurring',
        mode: 'online',
        startDate: '2026-01-10',
        status: 'active',
      ),
    ];
    await tester.pumpWidget(
      ProviderScope(
        overrides: [classesRepositoryProvider.overrideWithValue(_FakeClassesRepository(classes))],
        child: const MaterialApp(home: ClassListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Guitar Batch A'), findsOneWidget);
    expect(find.text('Piano Basics'), findsOneWidget);
  });
}
