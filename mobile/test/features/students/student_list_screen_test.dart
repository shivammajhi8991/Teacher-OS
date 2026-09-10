import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/auth/domain/entities/app_user.dart';
import 'package:teacheros/features/auth/presentation/providers/auth_providers.dart';
import 'package:teacheros/features/auth/presentation/providers/auth_state.dart';
import 'package:teacheros/features/students/domain/entities/guardian_info.dart';
import 'package:teacheros/features/students/domain/entities/guardian_input.dart';
import 'package:teacheros/features/students/domain/entities/student.dart';
import 'package:teacheros/features/students/domain/entities/student_detail.dart';
import 'package:teacheros/features/students/domain/entities/student_import_job.dart';
import 'package:teacheros/features/students/domain/repositories/students_repository.dart';
import 'package:teacheros/features/students/presentation/providers/students_providers.dart';
import 'package:teacheros/features/students/presentation/screens/student_list_screen.dart';

/// `StudentListScreen` now gates Add/Invite/Import on the caller's role (see the screen's own
/// class doc comment) — a bare `ProviderScope` leaves `authNotifierProvider` in its real
/// `build()`'s default `AuthUnknown` state (it never resolves `_restoreSession`'s network call
/// in a test), which would hide those actions regardless of which behaviour a given test means
/// to exercise. Overriding the whole notifier sidesteps that network call entirely rather than
/// fighting it.
class _FakeAuthNotifier extends AuthNotifier {
  _FakeAuthNotifier(this.user);
  final AppUser user;

  @override
  AuthState build() => AuthAuthenticated(user);
}

const _teacherUser = AppUser(
  id: 'user-teacher',
  fullName: 'Meera Joshi',
  preferredLanguage: 'en',
  activeRole: 'teacher',
);

class _FakeStudentsRepository implements StudentsRepository {
  _FakeStudentsRepository(this._students);
  final List<Student> _students;

  @override
  Future<Result<List<Student>>> listStudents({String? status, String? q}) async =>
      Ok(_students);

  @override
  Future<Result<Student>> createStudent({
    required String fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? joinDate,
    List<GuardianInput> guardians = const [],
  }) =>
      throw UnimplementedError();

  @override
  Future<Result<StudentDetail>> getStudentDetail(String id) => throw UnimplementedError();

  @override
  Future<Result<Student>> updateStudent(String id, {String? fullName, String? dob, String? gender, String? emergencyContactName, String? emergencyContactPhone, String? medicalNotes, String? enrollmentStatus}) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> archiveStudent(String id) => throw UnimplementedError();

  @override
  Future<Result<GuardianInfo>> addGuardian(String studentId, GuardianInput guardian) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> mergeStudents({required String survivingStudentId, required String mergedStudentId, required String reason}) =>
      throw UnimplementedError();

  @override
  Future<Result<StudentInviteResult>> createInvite({int? expiresInDays}) =>
      throw UnimplementedError();

  @override
  Future<Result<StudentImportJob>> createImportJob(Uint8List fileBytes, String filename) =>
      throw UnimplementedError();

  @override
  Future<Result<StudentImportJob>> getImportJob(String id) => throw UnimplementedError();
}

// docs/05 §5.7 — widget test for the primary Student Management screen: empty state when there
// are no students, and a populated list otherwise (docs/08 §8.6 empty-state pattern).
void main() {
  testWidgets('shows the empty state with an Add Student CTA when there are no students', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentsRepositoryProvider.overrideWithValue(_FakeStudentsRepository(const [])),
          authNotifierProvider.overrideWith(() => _FakeAuthNotifier(_teacherUser)),
        ],
        child: const MaterialApp(home: StudentListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No students yet — add your first student to get started.'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Add Student'), findsOneWidget);
  });

  testWidgets('renders a tile per student when the list is populated', (tester) async {
    const students = [
      Student(id: '1', fullName: 'Aarav Shah', joinDate: '2026-01-10', enrollmentStatus: 'active'),
      Student(id: '2', fullName: 'Diya Mehta', joinDate: '2026-02-01', enrollmentStatus: 'inactive'),
    ];
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentsRepositoryProvider.overrideWithValue(_FakeStudentsRepository(students)),
        ],
        child: const MaterialApp(home: StudentListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Aarav Shah'), findsOneWidget);
    expect(find.text('Diya Mehta'), findsOneWidget);
  });

  // docs/06 §6.2 gives Institute Admin full access to *existing* students, but
  // StudentsService.create (which Add/Invite/Import all ultimately call) has its own real,
  // separate TEACHER_PROFILE_REQUIRED gate no institute_admin account can pass — see the
  // screen's own class doc comment. This is the regression guard for the fix: the role check,
  // not just "does the list render."
  testWidgets(
    'hides Add/Invite/Import for an institute_admin, since those would 403 for that role',
    (tester) async {
      const instituteAdmin = AppUser(
        id: 'user-admin',
        fullName: 'Priya Nair',
        preferredLanguage: 'en',
        activeRole: 'institute_admin',
        instituteId: 'institute-1',
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            studentsRepositoryProvider.overrideWithValue(_FakeStudentsRepository(const [])),
            authNotifierProvider.overrideWith(() => _FakeAuthNotifier(instituteAdmin)),
          ],
          child: const MaterialApp(home: StudentListScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No students yet.'), findsOneWidget);
      expect(find.text('No students yet — add your first student to get started.'), findsNothing);
      expect(find.byType(FloatingActionButton), findsNothing);
      expect(find.widgetWithText(FilledButton, 'Add Student'), findsNothing);
      expect(find.byTooltip('Invite student'), findsNothing);
      expect(find.byTooltip('Import CSV'), findsNothing);
    },
  );
}
