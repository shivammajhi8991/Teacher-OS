import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/teaching_class.dart';
import '../providers/classes_providers.dart';
import 'class_detail_screen.dart';
import 'class_form_screen.dart';

/// docs/08 §8.2 "Class list" — filtered by status, tap through to detail.
class ClassListScreen extends ConsumerWidget {
  const ClassListScreen({super.key});

  Future<void> _openAddClass(BuildContext context, WidgetRef ref) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ClassFormScreen()),
    );
    if (created == true) ref.invalidate(classListProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classesAsync = ref.watch(classListProvider);
    final filter = ref.watch(classListFilterProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Classes')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _StatusChip(
                    label: 'All',
                    selected: filter == null,
                    onSelected: () => ref.read(classListFilterProvider.notifier).state = null,
                  ),
                  const SizedBox(width: 8),
                  for (final status in const ['active', 'completed', 'cancelled'])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _StatusChip(
                        label: status[0].toUpperCase() + status.substring(1),
                        selected: filter == status,
                        onSelected: () => ref.read(classListFilterProvider.notifier).state = status,
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: classesAsync.when(
              loading: () => const LoadingView(),
              error: (error, stackTrace) => ErrorView(
                failure: UnexpectedFailure(message: error.toString()),
                onRetry: () => ref.invalidate(classListProvider),
              ),
              data: (result) => result.fold(
                (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(classListProvider)),
                (classes) => classes.isEmpty
                    ? EmptyState(
                        message: 'No classes yet — create your first class to start taking attendance.',
                        actionLabel: 'Create Class',
                        onAction: () => _openAddClass(context, ref),
                      )
                    : RefreshIndicator(
                        onRefresh: () async => ref.invalidate(classListProvider),
                        child: ListView.separated(
                          itemCount: classes.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) => _ClassTile(teachingClass: classes[index]),
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openAddClass(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.selected, required this.onSelected});

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onSelected());
  }
}

class _ClassTile extends StatelessWidget {
  const _ClassTile({required this.teachingClass});

  final TeachingClass teachingClass;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(teachingClass.mode == 'online' ? Icons.videocam_outlined : Icons.location_on_outlined),
      title: Text(teachingClass.name),
      subtitle: Text(teachingClass.subjectOrActivity ?? teachingClass.classType),
      trailing: Chip(
        label: Text(teachingClass.status, style: const TextStyle(fontSize: 12)),
        visualDensity: VisualDensity.compact,
        side: BorderSide.none,
      ),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ClassDetailScreen(classId: teachingClass.id)),
      ),
    );
  }
}
