import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/notification_preference.dart';
import '../providers/notifications_providers.dart';

const _categoryLabels = {
  'payment': 'Payments',
  'fee': 'Fees & invoices',
  'note': 'Shared notes',
  'general': 'General',
};

// 'email' is deliberately excluded — docs/03 §3.8 lists it as a valid channel, but no mail
// adapter is wired up in this pass (notification.entity.ts documents it as a no-op today), so
// offering it here would promise something that doesn't happen yet.
const _channelOptions = <String, String>{
  'push': 'Real-time',
  'digest_daily': 'Daily digest',
  'digest_weekly': 'Weekly digest',
  'off': 'Off',
};

/// docs/08 §8.1 "Notification preferences: Per-category channel toggle." Reached from
/// [NotificationCenterScreen]'s app bar — see that screen's header comment for why, not from a
/// Profile/Settings tab.
class NotificationPreferencesScreen extends ConsumerWidget {
  const NotificationPreferencesScreen({super.key});

  Future<void> _updateChannel(WidgetRef ref, String category, String channel) async {
    final result = await ref
        .read(notificationsRepositoryProvider)
        .updatePreference(category: category, channel: channel);
    result.fold((_) {}, (_) => ref.invalidate(notificationPreferencesProvider));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferencesAsync = ref.watch(notificationPreferencesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notification preferences')),
      body: preferencesAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(notificationPreferencesProvider),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(notificationPreferencesProvider)),
          (preferences) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final preference in preferences) _PreferenceRow(preference: preference, onChanged: _updateChannel),
            ],
          ),
        ),
      ),
    );
  }
}

class _PreferenceRow extends StatelessWidget {
  const _PreferenceRow({required this.preference, required this.onChanged});

  final NotificationPreference preference;
  final void Function(WidgetRef ref, String category, String channel) onChanged;

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _categoryLabels[preference.category] ?? preference.category,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final entry in _channelOptions.entries)
                    ChoiceChip(
                      label: Text(entry.value),
                      selected: preference.channel == entry.key,
                      onSelected: (_) => onChanged(ref, preference.category, entry.key),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
