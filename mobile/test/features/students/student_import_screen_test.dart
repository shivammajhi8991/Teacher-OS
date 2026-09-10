import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/students/domain/entities/guardian_info.dart';
import 'package:teacheros/features/students/domain/entities/guardian_input.dart';
import 'package:teacheros/features/students/domain/entities/student.dart';
import 'package:teacheros/features/students/domain/entities/student_detail.dart';
import 'package:teacheros/features/students/domain/entities/student_import_job.dart';
import 'package:teacheros/features/students/domain/repositories/students_repository.dart';
import 'package:teacheros/features/students/presentation/providers/students_providers.dart';
import 'package:teacheros/features/students/presentation/screens/student_import_screen.dart';

/// `FilePicker.platform` is itself the plugin's own test seam (a `PlatformInterface`-backed
/// static, the same pattern every federated plugin uses) — swapping it for a fake result avoids
/// ever touching the real OS document picker in a widget test.
class _FakeFilePicker extends FilePicker {
  _FakeFilePicker(this.result);
  final FilePickerResult? result;

  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = true,
    int compressionQuality = 30,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) async =>
      result;
}

class _FakeStudentsRepository implements StudentsRepository {
  _FakeStudentsRepository({required this.createdJob, required this.polledJob});

  final StudentImportJob createdJob;
  final StudentImportJob polledJob;
  Uint8List? lastUploadedBytes;
  String? lastUploadedFilename;

  @override
  Future<Result<StudentImportJob>> createImportJob(Uint8List fileBytes, String filename) async {
    lastUploadedBytes = fileBytes;
    lastUploadedFilename = filename;
    return Ok(createdJob);
  }

  @override
  Future<Result<StudentImportJob>> getImportJob(String id) async => Ok(polledJob);

  @override
  Future<Result<List<Student>>> listStudents({String? status, String? q}) =>
      throw UnimplementedError();

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
  Future<Result<Student>> updateStudent(
    String id, {
    String? fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? enrollmentStatus,
  }) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> archiveStudent(String id) => throw UnimplementedError();

  @override
  Future<Result<GuardianInfo>> addGuardian(String studentId, GuardianInput guardian) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> mergeStudents({
    required String survivingStudentId,
    required String mergedStudentId,
    required String reason,
  }) =>
      throw UnimplementedError();

  @override
  Future<Result<StudentInviteResult>> createInvite({int? expiresInDays}) =>
      throw UnimplementedError();
}

// docs/04 §4.4/§4.7 — widget test for the flow this screen exists for: pick a file, upload it,
// poll until the fire-and-forget server-side job finishes, and show real success/failure counts
// plus any per-row errors — never a single pass/fail verdict for the whole file.
void main() {
  // `FilePicker.platform`'s backing field is `static late` and only ever initialized by the
  // real plugin's generated registrant at app startup — never in a widget-test process — so
  // there is no real value to read back and restore; each test sets its own fake outright.
  testWidgets('picks a CSV, uploads it, polls to completion, and shows the per-row results', (
    tester,
  ) async {
    final pickedBytes = Uint8List.fromList('fullName\nAarav Shah'.codeUnits);
    FilePicker.platform = _FakeFilePicker(
      FilePickerResult([PlatformFile(name: 'roster.csv', size: pickedBytes.length, bytes: pickedBytes)]),
    );

    final createdJob = StudentImportJob(
      id: 'job-1',
      status: 'pending',
      totalRows: 2,
      successCount: 0,
      failureCount: 0,
      errors: const [],
      createdAt: DateTime(2026, 1, 1),
    );
    final polledJob = StudentImportJob(
      id: 'job-1',
      status: 'completed',
      totalRows: 2,
      successCount: 1,
      failureCount: 1,
      errors: const [StudentImportRowError(row: 3, message: 'fullName is required')],
      createdAt: DateTime(2026, 1, 1),
      completedAt: DateTime(2026, 1, 1, 0, 0, 2),
    );
    final fakeRepository = _FakeStudentsRepository(createdJob: createdJob, polledJob: polledJob);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [studentsRepositoryProvider.overrideWithValue(fakeRepository)],
        child: const MaterialApp(home: StudentImportScreen()),
      ),
    );

    await tester.tap(find.text('Choose a CSV file'));
    await tester.pumpAndSettle();

    expect(find.text('roster.csv'), findsOneWidget);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Upload'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(fakeRepository.lastUploadedFilename, 'roster.csv');
    expect(fakeRepository.lastUploadedBytes, pickedBytes);

    // Totals from the completed job, not the pending one the upload call first returned.
    expect(find.text('2'), findsOneWidget); // Total rows
    expect(find.text('1'), findsNWidgets(2)); // Imported and Failed are both 1
    expect(find.text('Row 3'), findsOneWidget);
    expect(find.text('fullName is required'), findsOneWidget);
  });
}
