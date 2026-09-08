import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/modernist.dart';
import '../../../students/domain/entities/student.dart';
import '../providers/parent_providers.dart';

/// docs/08 §8.1 Parent shell: "Dashboard · Child switcher (if >1 child) · Fees · ...". Rendered
/// as the dashboard's AppBar `bottom` (visible on every tab, not just Dashboard, since Fees also
/// scopes to "whichever child is selected") — only ever constructed by ParentDashboardScreen once
/// it already knows there's more than one linked child; a single child needs no switcher at all.
///
/// Modernist redesign (design_handoff_modernist/README.md's "Parent home" row): "Child switcher
/// as two flush-left 20px/800 tabs with a 3px accent underline (replacing the ChoiceChip row)."
/// The prototype's own two-kid example is the common case, but nothing here assumes exactly two —
/// it lays out however many linked children there are, still flush left and equal-width.
class ChildSwitcherBar extends ConsumerWidget implements PreferredSizeWidget {
  const ChildSwitcherBar({super.key, required this.children, required this.selectedId});

  final List<Student> children;
  final String selectedId;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: preferredSize.height,
      child: Padding(
        padding: const EdgeInsets.only(left: M.gutter),
        child: Row(
          children: [
            for (final child in children)
              Padding(
                padding: const EdgeInsets.only(right: M.s6),
                child: Semantics(
                  selected: child.id == selectedId,
                  button: true,
                  child: InkWell(
                    onTap: () => ref.read(selectedChildIdProvider.notifier).state = child.id,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          child.fullName,
                          style: M.subTitle.copyWith(
                            color: child.id == selectedId
                                ? scheme.onSurface
                                : scheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: M.s2),
                        Container(
                          height: 3,
                          width: 28,
                          color: child.id == selectedId ? M.accent : Colors.transparent,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
