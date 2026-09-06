import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../onboarding/domain/entities/teacher_category.dart';
import '../../../onboarding/presentation/providers/teacher_profile_providers.dart';
import '../providers/admin_providers.dart';

/// docs/08 §8.2 Admin Web Panel "Teacher categories | Add/edit categories + default templates —
/// the 'no code change' mechanism (docs/01 §1.1)." Lists the same active categories the
/// onboarding picker shows (`teacherCategoriesProvider`, already built) rather than a second
/// admin-only "list all" endpoint — deactivating one here removes it from that same picker
/// immediately. A documented gap: `GET /teacher-categories` only ever returns active categories,
/// so a category deactivated from here has no way back to visible in this screen to reactivate —
/// real on the backend (`PATCH .../isActive: true` works), just not reachable from this list.
class AdminTeacherCategoriesScreen extends ConsumerWidget {
  const AdminTeacherCategoriesScreen({super.key});

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final nameController = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New teacher category'),
        content: TextField(
          controller: nameController,
          decoration: const InputDecoration(labelText: 'Name'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(nameController.text.trim()),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    final result = await ref.read(adminRepositoryProvider).createTeacherCategory(name: name);
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(teacherCategoriesProvider),
    );
  }

  Future<void> _deactivate(BuildContext context, WidgetRef ref, TeacherCategory category) async {
    final result =
        await ref.read(adminRepositoryProvider).updateTeacherCategory(category.id, isActive: false);
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(teacherCategoriesProvider),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(teacherCategoriesProvider);

    return Scaffold(
      body: categoriesAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(teacherCategoriesProvider),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(teacherCategoriesProvider)),
          (categories) => categories.isEmpty
              ? const EmptyState(icon: Icons.category_outlined, message: 'No categories yet.')
              : ListView.separated(
                  itemCount: categories.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final category = categories[index];
                    return ListTile(
                      leading: const Icon(Icons.category_outlined),
                      title: Text(category.name),
                      subtitle: Text(category.slug),
                      trailing: TextButton(
                        onPressed: () => _deactivate(context, ref, category),
                        child: const Text('Deactivate'),
                      ),
                    );
                  },
                ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _create(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }
}
