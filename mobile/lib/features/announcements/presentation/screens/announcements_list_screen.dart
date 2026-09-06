import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/announcement.dart';
import '../providers/announcements_providers.dart';

/// docs/08 §8.2 "Announcements" — read-only for Student ("from Notification center") and Parent
/// (its own dashboard tab); Institute Admin additionally composes here ("Dashboard quick action"
/// → institute-wide broadcast), so [composeTargetType] is only ever passed by that caller.
/// `GET /announcements` scopes to the caller automatically — this screen passes no filter.
class AnnouncementsListScreen extends ConsumerWidget {
  const AnnouncementsListScreen({super.key, this.composeTargetType});

  /// When set (e.g. 'institute' for an institute_admin), a compose FAB is shown that posts a new
  /// announcement with this targetType. `null` (Student/Parent) renders a read-only list.
  final String? composeTargetType;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final announcementsAsync = ref.watch(announcementsListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Announcements')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(announcementsListProvider),
        child: announcementsAsync.when(
          loading: () => const LoadingView(),
          error: (error, stackTrace) => ErrorView(
            failure: UnexpectedFailure(message: error.toString()),
            onRetry: () => ref.invalidate(announcementsListProvider),
          ),
          data: (result) => result.fold(
            (failure) =>
                ErrorView(failure: failure, onRetry: () => ref.invalidate(announcementsListProvider)),
            (announcements) => announcements.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(icon: Icons.campaign_outlined, message: 'No announcements yet.'),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: announcements.length,
                    separatorBuilder: (_, __) => const Divider(),
                    itemBuilder: (context, index) => _AnnouncementTile(announcement: announcements[index]),
                  ),
          ),
        ),
      ),
      floatingActionButton: composeTargetType == null
          ? null
          : FloatingActionButton(
              onPressed: () => _openComposeSheet(context, ref),
              child: const Icon(Icons.add),
            ),
    );
  }

  Future<void> _openComposeSheet(BuildContext context, WidgetRef ref) async {
    final posted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ComposeSheet(targetType: composeTargetType!),
    );
    if (posted == true) ref.invalidate(announcementsListProvider);
  }
}

class _AnnouncementTile extends StatelessWidget {
  const _AnnouncementTile({required this.announcement});

  final Announcement announcement;

  IconData get _icon => switch (announcement.targetType) {
        'platform' => Icons.public_outlined,
        'institute' => Icons.apartment_outlined,
        _ => Icons.class_outlined,
      };

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(_icon),
      title: Text(announcement.title),
      subtitle: Text(announcement.body, maxLines: 3, overflow: TextOverflow.ellipsis),
      trailing: Text(
        announcement.createdAt.toLocal().toString().substring(0, 10),
        style: Theme.of(context).textTheme.bodySmall,
      ),
      isThreeLine: true,
    );
  }
}

class _ComposeSheet extends ConsumerStatefulWidget {
  const _ComposeSheet({required this.targetType});

  final String targetType;

  @override
  ConsumerState<_ComposeSheet> createState() => _ComposeSheetState();
}

class _ComposeSheetState extends ConsumerState<_ComposeSheet> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();
    if (title.isEmpty || body.isEmpty) {
      setState(() => _error = 'Title and message are both required.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final result = await ref.read(announcementsRepositoryProvider).createAnnouncement(
          targetType: widget.targetType,
          title: title,
          body: body,
        );
    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _submitting = false;
        _error = failure.message;
      }),
      (_) => Navigator.of(context).pop(true),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('New announcement', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          TextField(
            controller: _titleController,
            decoration: const InputDecoration(labelText: 'Title'),
            enabled: !_submitting,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _bodyController,
            decoration: const InputDecoration(labelText: 'Message'),
            maxLines: 4,
            enabled: !_submitting,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Send'),
          ),
        ],
      ),
    );
  }
}
