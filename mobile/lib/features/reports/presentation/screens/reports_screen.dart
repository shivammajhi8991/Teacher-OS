import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../students/presentation/providers/students_providers.dart';
import '../../domain/entities/generated_report.dart';
import '../providers/reports_providers.dart';

enum _ReportKind { attendance, fees, student }

/// docs/08 §8.2 Teacher "Reports | Attendance/fee/student report builder, export" and Institute
/// Admin "Reports | Institute-scope attendance/fee/revenue reports" — one shared screen for both
/// (the backend already resolves "own scope" vs. "institute scope" server-side, so the form is
/// identical either way). `POST /export-jobs`'s async path (docs/04 §4.7) has no mobile UI this
/// pass — a documented scope cut: the direct `GET /reports/*` routes already cover this app's
/// real scale, and building a polling UI for "large" exports without a realistic large dataset to
/// test it against would be speculative. Revenue/payouts summary (docs/08's separate "Reports"
/// sub-item for Institute Admin) is a further scope cut, matching Branches/Payouts precedent.
class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  _ReportKind _kind = _ReportKind.attendance;
  String _format = 'csv';
  DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  DateTime _to = DateTime.now();
  String? _studentId;
  bool _generating = false;
  String? _error;
  GeneratedReport? _result;
  String? _savedPath;

  String _fmt(DateTime d) => d.toIso8601String().substring(0, 10);

  Future<void> _pickDate({required bool isFrom}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? _from : _to,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    setState(() => isFrom ? _from = picked : _to = picked);
  }

  Future<void> _generate() async {
    if (_kind == _ReportKind.student && _studentId == null) {
      setState(() => _error = 'Choose a student first.');
      return;
    }
    setState(() {
      _generating = true;
      _error = null;
      _result = null;
      _savedPath = null;
    });

    final repo = ref.read(reportsRepositoryProvider);
    final result = switch (_kind) {
      _ReportKind.attendance => await repo.generateAttendanceReport(
          from: _fmt(_from),
          to: _fmt(_to),
          format: _format,
        ),
      _ReportKind.fees => await repo.generateFeesReport(from: _fmt(_from), to: _fmt(_to), format: _format),
      _ReportKind.student => await repo.generateStudentReport(_studentId!),
    };

    if (!mounted) return;
    // Both branches are async (one just resolves immediately) so `fold`'s two callbacks unify to
    // the same `Future<void> Function(...)` type — mixing a sync and an async branch here is a
    // real type error (fold infers one `R` for both).
    await result.fold(
      (failure) async => setState(() {
        _generating = false;
        _error = failure.message;
      }),
      (report) async {
        if (report.isCsv) {
          setState(() {
            _generating = false;
            _result = report;
          });
          return;
        }
        // No PDF viewer/opener dependency in this pass (matching Notes' link-only precedent) —
        // save to the app's own documents directory and tell the reader exactly where, rather
        // than pretending to open it.
        final dir = await getApplicationDocumentsDirectory();
        final file = File('${dir.path}/${report.filename}');
        await file.writeAsBytes(report.bytes);
        if (!mounted) return;
        setState(() {
          _generating = false;
          _result = report;
          _savedPath = file.path;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<_ReportKind>(
            segments: const [
              ButtonSegment(value: _ReportKind.attendance, label: Text('Attendance')),
              ButtonSegment(value: _ReportKind.fees, label: Text('Fees')),
              ButtonSegment(value: _ReportKind.student, label: Text('Student')),
            ],
            selected: {_kind},
            onSelectionChanged: (s) => setState(() {
              _kind = s.first;
              _result = null;
              _savedPath = null;
              _error = null;
            }),
          ),
          const SizedBox(height: 16),
          if (_kind == _ReportKind.student) _buildStudentPicker() else _buildDateRangeAndFormat(),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _generating ? null : _generate,
            icon: _generating
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.summarize_outlined),
            label: const Text('Generate'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          if (_result != null) ...[
            const SizedBox(height: 20),
            _buildResult(),
          ],
        ],
      ),
    );
  }

  Widget _buildDateRangeAndFormat() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => _pickDate(isFrom: true),
                child: Text('From: ${_fmt(_from)}'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton(
                onPressed: () => _pickDate(isFrom: false),
                child: Text('To: ${_fmt(_to)}'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'csv', label: Text('CSV')),
            ButtonSegment(value: 'pdf', label: Text('PDF')),
          ],
          selected: {_format},
          onSelectionChanged: (s) => setState(() => _format = s.first),
        ),
      ],
    );
  }

  Widget _buildStudentPicker() {
    final studentsAsync = ref.watch(studentListProvider);
    return studentsAsync.when(
      loading: () => const LoadingView(),
      error: (_, __) => const Text('Could not load students.'),
      data: (result) => result.fold(
        (failure) => Text(failure.message),
        // `value:` is flagged deprecated by this Flutter SDK in favor of `initialValue:` — left
        // as-is deliberately: `initialValue` only seeds the field once rather than staying in
        // sync with `_studentId` on every rebuild (a real behavioral difference, not just a
        // rename), and this screen has no way to visually confirm the dropdown still reflects
        // state correctly after switching, in an environment with no Flutter SDK to run the app
        // until this same Phase 6 CI pass. Safe to leave — `value` still works, just deprecated,
        // not removed.
        (students) => DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: _studentId,
          decoration: const InputDecoration(labelText: 'Student'),
          items: [
            for (final s in students) DropdownMenuItem(value: s.id, child: Text(s.fullName)),
          ],
          onChanged: (value) => setState(() => _studentId = value),
        ),
      ),
    );
  }

  Widget _buildResult() {
    final report = _result!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle_outline, color: Colors.green),
                const SizedBox(width: 8),
                Expanded(child: Text(report.filename, style: Theme.of(context).textTheme.titleMedium)),
              ],
            ),
            const SizedBox(height: 12),
            if (report.isCsv)
              Container(
                width: double.infinity,
                constraints: const BoxConstraints(maxHeight: 300),
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SingleChildScrollView(
                  child: SelectableText(
                    utf8.decode(report.bytes),
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                  ),
                ),
              )
            else
              Text('Saved to: $_savedPath'),
          ],
        ),
      ),
    );
  }
}
