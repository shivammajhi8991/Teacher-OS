import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/students/domain/entities/guardian_info.dart';
import 'package:teacheros/features/students/domain/entities/guardian_input.dart';
import 'package:teacheros/features/students/domain/entities/student.dart';
import 'package:teacheros/features/students/domain/entities/student_detail.dart';
import 'package:teacheros/features/students/domain/repositories/students_repository.dart';
import 'package:teacheros/features/students/presentation/providers/students_providers.dart';
import 'package:teacheros/features/students/presentation/screens/student_list_screen.dart';

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
}
