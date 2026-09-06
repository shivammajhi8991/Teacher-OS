import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../students/domain/entities/student.dart';
import '../providers/parent_providers.dart';

/// docs/08 §8.1 Parent shell: "Dashboard · Child switcher (if >1 child) · Fees · ...". Rendered
/// as the dashboard's AppBar `bottom` (visible on every tab, not just Dashboard, since Fees also
/// scopes to "whichever child is selected") — only ever constructed by ParentDashboardScreen once
/// it already knows there's more than one linked child; a single child needs no switcher at all.
class ChildSwitcherBar extends ConsumerWidget implements PreferredSizeWidget {
  const ChildSwitcherBar({super.key, required this.children, required this.selectedId});

  final List<Student> children;
  final String selectedId;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      height: preferredSize.height,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: [
          for (final child in children)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(child.fullName),
                selected: child.id == selectedId,
                onSelected: (_) => ref.read(selectedChildIdProvider.notifier).state = child.id,
              ),
            ),
        ],
      ),
    );
  }
}
