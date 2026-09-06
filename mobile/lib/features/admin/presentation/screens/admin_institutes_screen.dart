import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../institutes/domain/entities/institute.dart';
import '../../../institutes/presentation/providers/institutes_providers.dart';

/// docs/08 §8.2 Admin Web Panel "Institutes | List, drill into any institute's admin view" —
/// reuses the plain `GET /institutes` list every authenticated user already has read access to;
/// "drill in" here is a simple read-only detail sheet (name/contact/status), not a separate
/// screen — there's no institute-specific admin *action* this pass adds beyond what Institute
/// Admin's own dashboard (Phase 5 step 4) already covers for that institute's own admin.
class AdminInstitutesScreen extends ConsumerWidget {
  const AdminInstitutesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final institutesAsync = ref.watch(allInstitutesProvider);

    return Scaffold(
      body: institutesAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(allInstitutesProvider),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(allInstitutesProvider)),
          (institutes) => institutes.isEmpty
              ? const EmptyState(icon: Icons.apartment_outlined, message: 'No institutes yet.')
              : RefreshIndicator(
                  onRefresh: () async => ref.invalidate(allInstitutesProvider),
                  child: ListView.separated(
                    itemCount: institutes.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) => _InstituteTile(institute: institutes[index]),
                  ),
                ),
        ),
      ),
    );
  }
}

class _InstituteTile extends StatelessWidget {
  const _InstituteTile({required this.institute});

  final Institute institute;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: const Icon(Icons.apartment_outlined),
      title: Text(institute.name),
      subtitle: Text(institute.contactEmail ?? institute.address ?? institute.status),
      trailing: Chip(
        label: Text(institute.status, style: const TextStyle(fontSize: 12)),
        visualDensity: VisualDensity.compact,
        side: BorderSide.none,
      ),
      onTap: () => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(institute.name),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Status: ${institute.status}'),
              if (institute.address != null) Text('Address: ${institute.address}'),
              if (institute.contactEmail != null) Text('Email: ${institute.contactEmail}'),
              if (institute.contactPhone != null) Text('Phone: ${institute.contactPhone}'),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
          ],
        ),
      ),
    );
  }
}
