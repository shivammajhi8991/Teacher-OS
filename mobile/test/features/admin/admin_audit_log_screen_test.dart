import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/admin/domain/entities/admin_teacher_category.dart';
import 'package:teacheros/features/admin/domain/entities/admin_user.dart';
import 'package:teacheros/features/admin/domain/entities/audit_log_entry.dart';
import 'package:teacheros/features/admin/domain/entities/verification_queue_entry.dart';
import 'package:teacheros/features/admin/domain/repositories/admin_repository.dart';
import 'package:teacheros/features/admin/presentation/providers/admin_providers.dart';
import 'package:teacheros/features/admin/presentation/screens/admin_audit_log_screen.dart';

class _FakeAdminRepository implements AdminRepository {
  _FakeAdminRepository({required this.firstPage, this.secondPage});

  final AuditLogPage firstPage;
  final AuditLogPage? secondPage;
  String? lastSource;
  String? lastCursor;

  @override
  Future<Result<AuditLogPage>> listAuditLog({String? source, String? cursor, int limit = 50}) async {
    lastSource = source;
    lastCursor = cursor;
    return Ok(cursor == null ? firstPage : (secondPage ?? firstPage));
  }

  @override
  Future<Result<List<AdminUser>>> searchUsers({String? q, String? status}) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> updateUserStatus(String userId, String status) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> assignUserRole(String userId, {required String role, String? instituteId}) =>
      throw UnimplementedError();

  @override
  Future<Result<List<VerificationQueueEntry>>> listVerificationQueue() =>
      throw UnimplementedError();

  @override
  Future<Result<void>> reviewVerificationRequest(
    String requestId, {
    required String decision,
    String? rejectionReason,
  }) =>
      throw UnimplementedError();

  @override
  Future<Result<AdminTeacherCategory>> createTeacherCategory({required String name, String? icon}) =>
      throw UnimplementedError();

  @override
  Future<Result<AdminTeacherCategory>> updateTeacherCategory(String id, {bool? isActive}) =>
      throw UnimplementedError();
}

AuditLogEntry _entry({
  required String id,
  String source = 'attendance',
  String? changedByName = 'Meera Joshi',
}) =>
    AuditLogEntry(
      id: id,
      source: source,
      previousStatus: 'present',
      newStatus: 'absent',
      changedByName: changedByName,
      changedAt: DateTime(2026, 2, 1, 10, 0),
      note: 'Parent called in',
    );

// docs/08 §8.2 Admin Web Panel "Audit log" — the one real destination this pass adds behind
// AdminPanelShellScreen's own three previously-empty nav items. Covers the two things unique to
// this screen: rendering a real fetched page, and "Load more" fetching a second page with the
// first page's last cursor and appending rather than replacing.
void main() {
  testWidgets('renders the first page and loads a second page on "Load more"', (tester) async {
    final fakeRepository = _FakeAdminRepository(
      firstPage: AuditLogPage(
        entries: [_entry(id: 'log-1'), _entry(id: 'log-2', source: 'payment', changedByName: null)],
        nextCursor: '2026-02-01T09:00:00.000Z',
      ),
      secondPage: AuditLogPage(entries: [_entry(id: 'log-3')], nextCursor: null),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminRepositoryProvider.overrideWithValue(fakeRepository)],
        child: const MaterialApp(home: AdminAuditLogScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('present → absent'), findsNWidgets(2));
    expect(find.textContaining('Meera Joshi'), findsOneWidget);
    expect(find.textContaining('System'), findsOneWidget); // null changedByName on the payment row
    expect(find.text('Load more'), findsOneWidget);

    await tester.tap(find.text('Load more'));
    await tester.pumpAndSettle();

    expect(fakeRepository.lastCursor, '2026-02-01T09:00:00.000Z');
    expect(find.text('present → absent'), findsNWidgets(3));
    expect(find.text('No more entries.'), findsOneWidget);
  });

  testWidgets('re-fetches with the selected source filter', (tester) async {
    final fakeRepository = _FakeAdminRepository(
      firstPage: const AuditLogPage(entries: [], nextCursor: null),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminRepositoryProvider.overrideWithValue(fakeRepository)],
        child: const MaterialApp(home: AdminAuditLogScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(fakeRepository.lastSource, isNull);

    await tester.tap(find.text('Payments'));
    await tester.pumpAndSettle();

    expect(fakeRepository.lastSource, 'payment');
  });
}
