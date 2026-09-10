import 'dart:async';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../domain/entities/student_import_job.dart';
import '../providers/students_providers.dart';

/// docs/04 §4.4 "POST /students/import" — CSV, async job. `mobile/README.md` named this
/// repeatedly as deferred specifically because it needed `file_picker` (a new pubspec
/// dependency) — now added, this is that screen.
///
/// Flow: pick a `.csv` file via the platform's own document picker (no storage permission
/// needed — Storage Access Framework on Android, UIDocumentPicker on iOS, both hand back file
/// bytes directly via `withData: true` rather than a path this app would need extra permission
/// to read), `POST /students/import` (202 + a job in `pending`), then poll
/// `GET /students/import-jobs/:id` until the fire-and-forget server-side job reaches `completed`
/// or `failed`. One malformed row never aborts the whole import (docs/04 §4.7's own "natural
/// retry point"), so the result is always a real success/failure count plus a per-row error list
/// — never a single pass/fail verdict for the whole file.
///
/// Built Modernist (M.* tokens/primitives) like every other screen this project has built new,
/// regardless of the entry point's own styling — `StudentListScreen`, which pushes this, hasn't
/// been redesigned itself and isn't part of this change.
class StudentImportScreen extends ConsumerStatefulWidget {
  const StudentImportScreen({super.key});

  @override
  ConsumerState<StudentImportScreen> createState() => _StudentImportScreenState();
}

class _StudentImportScreenState extends ConsumerState<StudentImportScreen> {
  PlatformFile? _pickedFile;
  bool _isSubmitting = false;
  String? _errorMessage;
  StudentImportJob? _job;

  // Fire-and-forget processing in this app's own backend process typically finishes in well
  // under a second for any realistic class roster; this is a generous ceiling, not an expected
  // wait — see _checkStatusManually for what happens if it's ever actually hit.
  static const _maxPollAttempts = 20;
  static const _pollInterval = Duration(milliseconds: 1500);

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['csv'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return; // user cancelled
    setState(() {
      _pickedFile = result.files.first;
      _errorMessage = null;
    });
  }

  Future<void> _upload() async {
    final file = _pickedFile;
    final bytes = file?.bytes;
    if (file == null || bytes == null) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ref.read(createImportJobUseCaseProvider).call(bytes, file.name);
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (job) {
        setState(() => _job = job);
        _pollUntilDone(job.id);
      },
    );
  }

  Future<void> _pollUntilDone(String jobId) async {
    for (var attempt = 0; attempt < _maxPollAttempts; attempt++) {
      await Future<void>.delayed(_pollInterval);
      if (!mounted) return;
      final result = await ref.read(getImportJobUseCaseProvider).call(jobId);
      if (!mounted) return;
      final done = result.fold((failure) => false, (job) {
        setState(() => _job = job);
        return job.isDone;
      });
      if (done) {
        setState(() => _isSubmitting = false);
        return;
      }
    }
    // Gave up polling, not gave up on the job — it keeps running server-side regardless.
    setState(() => _isSubmitting = false);
  }

  Future<void> _checkStatusManually() async {
    final job = _job;
    if (job == null) return;
    setState(() => _isSubmitting = true);
    final result = await ref.read(getImportJobUseCaseProvider).call(job.id);
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (updated) => setState(() {
        _job = updated;
        _isSubmitting = false;
      }),
    );
  }

  void _reset() {
    setState(() {
      _pickedFile = null;
      _job = null;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final job = _job;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s1, M.gutter, M.s4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SquareIconButton(
                    icon: Icons.arrow_back,
                    tooltip: 'Back',
                    onPressed: () => Navigator.of(context).maybePop(job != null && job.successCount > 0),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(child: Text('Import students', style: M.sectionTitle)),
                ],
              ),
            ),
            if (job == null) ..._buildPickAndUpload(scheme) else ..._buildResults(scheme, job),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildPickAndUpload(ColorScheme scheme) {
    final file = _pickedFile;
    return [
      const MRule(),
      Padding(
        padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s2),
        child: Text(
          'Expected columns'.toUpperCase(),
          style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(M.gutter, 0, M.gutter, M.s4),
        child: Text(
          'The first row names the columns. Only fullName is required — dob, gender, joinDate, '
          'emergencyContactName, emergencyContactPhone, medicalNotes, guardianFullName, '
          'guardianPhone, guardianEmail, and guardianRelationship are all optional, and a row '
          'carries at most one guardian (add more from the student afterward).',
          style: M.body.copyWith(color: scheme.onSurfaceVariant),
        ),
      ),
      const MRule(),
      Padding(
        padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: _pickFile,
              child: Container(
                constraints: const BoxConstraints(minHeight: 80),
                padding: const EdgeInsets.all(M.s4),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerLow,
                  border: Border.all(color: scheme.outline),
                ),
                alignment: Alignment.centerLeft,
                child: file == null
                    ? Row(
                        children: [
                          Icon(Icons.upload_file_outlined, color: scheme.onSurfaceVariant),
                          const SizedBox(width: M.s3),
                          Text('Choose a CSV file', style: M.row.copyWith(color: scheme.onSurfaceVariant)),
                        ],
                      )
                    : Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(file.name, style: M.row, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 4),
                                Text(
                                  '${((file.size) / 1024).toStringAsFixed(1)} KB',
                                  style: M.meta.copyWith(color: scheme.onSurfaceVariant),
                                ),
                              ],
                            ),
                          ),
                          Text('CHANGE', style: M.label.copyWith(color: scheme.onSurfaceVariant)),
                        ],
                      ),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: M.s3),
              Text(_errorMessage!, style: M.body.copyWith(color: scheme.error)),
            ],
            const SizedBox(height: M.s6),
            MPrimaryAction(
              label: 'Upload',
              onPressed: (_isSubmitting || file == null) ? null : _upload,
              busy: _isSubmitting,
            ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _buildResults(ColorScheme scheme, StudentImportJob job) {
    final stillWorking = !job.isDone;
    return [
      const MRule(),
      MStatCells(
        cells: [
          (label: 'Total rows', value: '${job.totalRows}', tone: null),
          (label: 'Imported', value: '${job.successCount}', tone: null),
          (
            label: 'Failed',
            value: '${job.failureCount}',
            tone: job.failureCount > 0 ? M.accent700 : null,
          ),
        ],
      ),
      const MRule(),
      if (stillWorking)
        Padding(
          padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: M.s3),
                  Text('Still processing…', style: M.row.copyWith(color: scheme.onSurfaceVariant)),
                ],
              ),
              const SizedBox(height: M.s3),
              OutlinedButton(
                onPressed: _isSubmitting ? null : _checkStatusManually,
                child: const Text('Check status'),
              ),
              const SizedBox(height: M.s2),
              Text(
                "This file is still being processed on the server — it's safe to leave this "
                'screen; the new students will appear in the list once it finishes.',
                style: M.meta.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        )
      else ...[
        MSectionLabel(job.errors.isEmpty ? 'Done' : 'Row errors'),
        if (job.errors.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.gutter, M.s4),
            child: Text(
              'Every row imported cleanly.',
              style: M.body.copyWith(color: scheme.onSurfaceVariant),
            ),
          )
        else
          for (final (i, error) in job.errors.indexed) ...[
            if (i > 0) const MRowRule(),
            MRow(title: 'Row ${error.row}', sub: error.message),
          ],
        const MRule(),
        Padding(
          padding: const EdgeInsets.all(M.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MPrimaryAction(
                label: 'Done',
                onPressed: () => Navigator.of(context).maybePop(job.successCount > 0),
              ),
              if (job.errors.isNotEmpty) ...[
                const SizedBox(height: M.s2),
                OutlinedButton(onPressed: _reset, child: const Text('Import another file')),
              ],
            ],
          ),
        ),
      ],
    ];
  }
}

/// Same shape as `student_detail_screen.dart`'s own `_SquareIconButton` — screen-local by the
/// same precedent set there, not promoted into `modernist_primitives.dart`.
class _SquareIconButton extends StatelessWidget {
  const _SquareIconButton({required this.icon, required this.onPressed, this.tooltip});

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: tooltip ?? '',
      child: InkWell(
        onTap: onPressed,
        child: Container(
          width: M.tapMin,
          height: M.tapMin,
          decoration: BoxDecoration(border: Border.all(color: scheme.outline)),
          child: Icon(icon, size: 20, color: scheme.onSurface),
        ),
      ),
    );
  }
}
