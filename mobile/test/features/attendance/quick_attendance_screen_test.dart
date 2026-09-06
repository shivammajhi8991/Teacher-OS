import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/sync/sync_engine.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/attendance/domain/entities/attendance_roster.dart';
import 'package:teacheros/features/attendance/domain/entities/student_attendance_history.dart';
import 'package:teacheros/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:teacheros/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:teacheros/features/attendance/presentation/screens/quick_attendance_screen.dart';

/// Bypasses the real SyncEngine's build() (which talks to the connectivity_plus platform
/// channel) — the widget under test only reads pendingCount/status for its app-bar chip.
class _FakeSyncEngine extends SyncEngine {
  @override
  SyncEngineState build() => const SyncEngineState(status: SyncEngineStatus.synced, pendingCount: 0);
}

class _FakeAttendanceRepository implements AttendanceRepository {
  bool bulkMarkCalled = false;
  List<({String studentId, String status, String? notes})>? lastRecords;

  @override
  Future<Result<AttendanceRoster>> getRoster(String classId, String occurrenceDate) async {
    return Ok(
      AttendanceRoster(
        classId: classId,
        occurrenceDate: occurrenceDate,
        sessionId: null,
        isCancelled: false,
        students: const [
          RosterEntry(studentId: 's1', studentFullName: 'Aarav Shah'),
          RosterEntry(studentId: 's2', studentFullName: 'Diya Mehta'),
        ],
      ),
    );
  }

  @override
  Future<Result<AttendanceRoster>> bulkMark(
    String classId,
    String occurrenceDate,
    List<({String studentId, String status, String? notes})> records,
  ) async {
    bulkMarkCalled = true;
    lastRecords = records;
    return Ok(
      AttendanceRoster(
        classId: classId,
        occurrenceDate: occurrenceDate,
        sessionId: 'session-1',
        isCancelled: false,
        students: const [],
      ),
    );
  }

  // Added to AttendanceRepository by Phase 5 step 3 (Parent dashboard) — this Phase 4 step 5
  // fixture predates that and was never updated, invisible until `flutter analyze` actually ran
  // (Phase 6 CI, this codebase's first real compile-check). QuickAttendanceScreen itself never
  // calls this, so a fixed dummy is enough to satisfy the interface.
  @override
  Future<Result<StudentAttendanceHistory>> getStudentAttendanceHistory(String studentId) async {
    return Ok(StudentAttendanceHistory(studentId: studentId, percentage: null, records: const []));
  }
}

// docs/05 §5.7 — widget test for docs/08 §8.3's flagship flow: every student defaults to
// Present with zero taps, and tapping Save submits exactly that for a fully-present class.
void main() {
  testWidgets('defaults every student to Present so a fully-present class needs zero extra taps', (
    tester,
  ) async {
    final fakeRepository = _FakeAttendanceRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          attendanceRepositoryProvider.overrideWithValue(fakeRepository),
          syncEngineProvider.overrideWith(() => _FakeSyncEngine()),
        ],
        child: const MaterialApp(
          home: QuickAttendanceScreen(classId: 'class-1', initialDate: '2026-01-05'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Present'), findsNWidgets(2));

    await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
    await tester.pumpAndSettle();

    expect(fakeRepository.bulkMarkCalled, isTrue);
    expect(fakeRepository.lastRecords, hasLength(2));
    expect(fakeRepository.lastRecords!.every((r) => r.status == 'present'), isTrue);
  });

  testWidgets('tapping a student cycles their status away from the Present default', (tester) async {
    final fakeRepository = _FakeAttendanceRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          attendanceRepositoryProvider.overrideWithValue(fakeRepository),
          syncEngineProvider.overrideWith(() => _FakeSyncEngine()),
        ],
        child: const MaterialApp(
          home: QuickAttendanceScreen(classId: 'class-1', initialDate: '2026-01-05'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Present').first);
    await tester.pumpAndSettle();

    expect(find.text('Absent'), findsOneWidget);
    expect(find.text('Present'), findsOneWidget); // the other student stays Present
  });
}
