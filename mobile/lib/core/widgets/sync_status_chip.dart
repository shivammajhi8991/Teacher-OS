import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// docs/05 §5.4, docs/08 §8.5 — the persistent app-bar indicator: synced / syncing / N pending /
/// N conflicts (tappable → conflict resolution screen). Purely presentational here; wired to the
/// real `core/sync/SyncEngine` state (docs/05 §5.4) once that lands — see core/sync/README.md.
enum SyncStatus { synced, syncing, pending, conflict }

class SyncStatusChip extends StatelessWidget {
  const SyncStatusChip({
    super.key,
    required this.status,
    this.count = 0,
    this.onTap,
  });

  final SyncStatus status;
  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (icon, label, tone) = switch (status) {
      SyncStatus.synced => (Icons.check_circle, 'Synced', AppStatusTone.success),
      SyncStatus.syncing => (Icons.sync, 'Syncing…', AppStatusTone.info),
      SyncStatus.pending => (Icons.cloud_upload_outlined, '$count pending', AppStatusTone.warning),
      SyncStatus.conflict => (Icons.warning_amber, '$count conflicts', AppStatusTone.danger),
    };
    final color = tone.color(context);

    return InkWell(
      onTap: status == SyncStatus.conflict ? onTap : null,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(color: color, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
