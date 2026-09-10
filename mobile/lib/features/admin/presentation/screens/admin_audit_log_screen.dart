import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../domain/entities/audit_log_entry.dart';
import '../providers/admin_providers.dart';

/// docs/08 §8.2 Admin Web Panel "Audit log". Unifies `attendance_audit_log` and
/// `payment_audit_log` — the only two audit trails this codebase actually writes to — into one
/// time-sorted, cursor-paginated feed (`GET /admin/audit-logs`, admin.service.ts). Reported
/// content and System config, this shell's other two placeholder destinations, have no
/// equivalent screen: neither has a backing data model anywhere in this codebase (see
/// `admin_panel_shell_screen.dart`'s own doc comment) — nothing was invented for either.
///
/// Manages its own paginated state rather than a FutureProvider (matching Record Payment's own
/// polling loop and CSV import's own job-status fetch — not every async flow here needs a
/// provider, and incremental "load more" doesn't fit FutureProvider's single-fetch shape
/// cleanly).
class AdminAuditLogScreen extends ConsumerStatefulWidget {
  const AdminAuditLogScreen({super.key});

  @override
  ConsumerState<AdminAuditLogScreen> createState() => _AdminAuditLogScreenState();
}

class _AdminAuditLogScreenState extends ConsumerState<AdminAuditLogScreen> {
  String? _source;
  List<AuditLogEntry> _entries = [];
  String? _nextCursor;
  bool _isLoading = true;
  bool _isLoadingMore = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final result =
        await ref.read(adminRepositoryProvider).listAuditLog(source: _source);
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isLoading = false;
        _errorMessage = failure.message;
      }),
      (page) => setState(() {
        _isLoading = false;
        _entries = page.entries;
        _nextCursor = page.nextCursor;
      }),
    );
  }

  Future<void> _loadMore() async {
    final cursor = _nextCursor;
    if (cursor == null || _isLoadingMore) return;
    setState(() => _isLoadingMore = true);
    final result =
        await ref.read(adminRepositoryProvider).listAuditLog(source: _source, cursor: cursor);
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isLoadingMore = false;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message)));
      }),
      (page) => setState(() {
        _isLoadingMore = false;
        _entries = [..._entries, ...page.entries];
        _nextCursor = page.nextCursor;
      }),
    );
  }

  void _setSource(String? source) {
    if (source == _source) return;
    setState(() => _source = source);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: SegmentedButton<String?>(
              segments: const [
                ButtonSegment(value: null, label: Text('All')),
                ButtonSegment(value: 'attendance', label: Text('Attendance')),
                ButtonSegment(value: 'payment', label: Text('Payments')),
              ],
              selected: {_source},
              onSelectionChanged: (selection) => _setSource(selection.first),
            ),
          ),
          Expanded(child: _buildBody(context)),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_entries.isEmpty) {
      return const Center(child: Text('No audit entries yet.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _entries.length + 1,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          if (index == _entries.length) return _buildFooter();
          return _AuditLogTile(entry: _entries[index]);
        },
      ),
    );
  }

  Widget _buildFooter() {
    if (_nextCursor == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(child: Text('No more entries.', style: TextStyle(color: Colors.grey))),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: _isLoadingMore
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : OutlinedButton(onPressed: _loadMore, child: const Text('Load more')),
      ),
    );
  }
}

class _AuditLogTile extends StatelessWidget {
  const _AuditLogTile({required this.entry});

  final AuditLogEntry entry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        entry.source == 'attendance' ? Icons.fact_check_outlined : Icons.payments_outlined,
        color: colorScheme.onSurfaceVariant,
      ),
      title: Text('${entry.previousStatus} → ${entry.newStatus}'),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${entry.changedByName ?? 'System'} · '
            '${DateFormat('d MMM y, HH:mm').format(entry.changedAt.toLocal())}',
          ),
          if (entry.note != null && entry.note!.isNotEmpty) Text(entry.note!),
        ],
      ),
      isThreeLine: entry.note != null && entry.note!.isNotEmpty,
      trailing: Chip(
        label: Text(entry.source, style: const TextStyle(fontSize: 11)),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}
