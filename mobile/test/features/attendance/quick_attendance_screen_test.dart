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
//
// Modernist redesign (design_handoff_modernist/README.md): each roster row now carries all four
// states as an `MSegmented` control — direct selection, not the old cycling `ActionChip` — and
// renders its option labels upper-cased ("PRESENT", not "Present"). Both tests below were
// rewritten against that: the first no longer asserts on literal on-screen "Present" text (every
// row always shows all four upper-cased labels regardless of which is selected, so text presence
// alone no longer distinguishes "selected" from "just an option"; the submitted records are the
// real assertion) and the second — previously named for a "cycle" that no longer exists — now
// taps a specific student's ABSENT segment directly and confirms only that student's submitted
// status changed.
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

    expect(find.text('Aarav Shah'), findsOneWidget);
    expect(find.text('Diya Mehta'), findsOneWidget);

    // MPrimaryAction wraps the save bar in the only ElevatedButton on this screen; its label is
    // dynamic ("Save · all 2 present"), so byType is the stable way to find it.
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();

    expect(fakeRepository.bulkMarkCalled, isTrue);
    expect(fakeRepository.lastRecords, hasLength(2));
    expect(fakeRepository.lastRecords!.every((r) => r.status == 'present'), isTrue);
  });

  testWidgets(
    "tapping a student's Absent segment marks just that student absent (direct select, not cycling)",
    (tester) async {
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

      // "ABSENT" appears once in the pinned count strip's own MStatCells (not tappable there)
      // plus once per roster row's MSegmented — index 0 is the count strip, so index 1 is Aarav
      // Shah's row (the fake roster lists him first).
      await tester.tap(find.text('ABSENT').at(1));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(fakeRepository.bulkMarkCalled, isTrue);
      final statusByStudentId = {
        for (final r in fakeRepository.lastRecords!) r.studentId: r.status,
      };
      expect(statusByStudentId['s1'], 'absent'); // Aarav Shah — the one segment we tapped
      expect(statusByStudentId['s2'], 'present'); // Diya Mehta — untouched, stays default
    },
  );
}
