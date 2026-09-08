import 'package:flutter/material.dart';

import '../theme/modernist.dart';

/// The Modernist primitives every redesigned screen is built from. Six widgets replace what was
/// previously ad hoc `Card` + `Padding` + `ListTile` nesting per screen.
///
/// Rules, not cards, separate things: [MRule] between sections, [MRowRule] between rows inside
/// one section. Nothing here takes a corner radius or a shadow.

/// The 2px section rule. Use between major sections, never inside a list.
class MRule extends StatelessWidget {
  const MRule({super.key});

  @override
  Widget build(BuildContext context) =>
      Container(height: 2, color: Theme.of(context).colorScheme.outline);
}

/// The 1px row rule. Only between rows of the same list.
class MRowRule extends StatelessWidget {
  const MRowRule({super.key});

  @override
  Widget build(BuildContext context) =>
      Container(height: 1, color: Theme.of(context).colorScheme.outlineVariant);
}

/// A flush-left all-caps section kicker. [accent] marks a section that needs the user.
class MSectionLabel extends StatelessWidget {
  const MSectionLabel(this.text, {super.key, this.accent = false, this.trailing});

  final String text;
  final bool accent;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text.toUpperCase(),
              style: M.kicker.copyWith(
                letterSpacing: 1.32,
                color: accent
                    ? (dark ? M.accent500 : M.accent)
                    : (dark ? const Color(0x8CF3F2F2) : M.inkFaint),
              ),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// A rectangular tag. The only "container" in the system, and it never rounds.
class MTag extends StatelessWidget {
  const MTag(this.label, {super.key, this.emphasis = false});

  final String label;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
      color: emphasis ? M.accent200 : M.surface,
      child: Text(
        label.toUpperCase(),
        style: M.label.copyWith(
          fontSize: 10.5,
          letterSpacing: 0.84,
          color: emphasis ? M.accent800 : M.inkMuted,
        ),
      ),
    );
  }
}

/// The modular stat grid: equal-width cells, 1px vertical rules, a 2px rule top and bottom.
/// This is what replaces the four floating summary tiles on every dashboard.
class MStatCells extends StatelessWidget {
  const MStatCells({super.key, required this.cells, this.filled = false, this.perRow = 3});

  /// [tone] tints the value only — used to mark money that is late.
  final List<({String label, String value, Color? tone})> cells;
  final bool filled;

  /// Cells per row before wrapping — 3 (the README's own "three cells per row" spec) fits the
  /// dashboard footer grid's unconstrained scroll space. A fixed-height usage with a different
  /// cell count — the Quick Attendance count strip's 4 cells inside its pinned 74px
  /// `SliverPersistentHeader` — must pass its own cell count here: at the default of 3, those 4
  /// cells silently wrapped into a second row (3 + 1), roughly doubling the height this widget
  /// actually needed and overflowing the strip's fixed band by 85px (reproduced in
  /// `quick_attendance_screen_test.dart`) — a real layout bug, not a design-token issue, so the
  /// fix is here at the call site, not a change to any `M.*` value.
  final int perRow;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rows = <List<({String label, String value, Color? tone})>>[];
    for (var i = 0; i < cells.length; i += perRow) {
      rows.add(cells.sublist(i, (i + perRow).clamp(0, cells.length)));
    }

    return Container(
      color: filled ? scheme.surfaceContainerLow : null,
      child: Column(
        children: [
          for (final (rowIndex, row) in rows.indexed) ...[
            if (rowIndex > 0) const MRowRule(),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (i, cell) in row.indexed) ...[
                    if (i > 0)
                      Container(width: 1, color: scheme.outlineVariant),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          i == 0 ? M.gutter : M.s3,
                          M.s4,
                          i == row.length - 1 ? M.gutter : M.s3,
                          M.s4,
                        ),
                        // mainAxisSize.min (the original had .max via the unspecified default,
                        // plus mainAxisAlignment.spaceBetween) — .min is the unambiguous choice
                        // for a Column sized by IntrinsicHeight/Expanded: the SizedBox below
                        // already supplies the value→label gap, so spaceBetween's stretch
                        // behavior was doing nothing except leaving this Column's actual sizing
                        // intent unstated. Not the cause of the perRow overflow below — just a
                        // correctness cleanup that ships alongside it.
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              cell.value,
                              style: M.data.copyWith(color: cell.tone ?? scheme.onSurface),
                            ),
                            const SizedBox(height: M.s2),
                            Text(
                              cell.label.toUpperCase(),
                              style: M.kicker.copyWith(
                                fontSize: 10,
                                height: 1.3,
                                letterSpacing: 1.0,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The primary action: full-width accent fill, label flush left, marker on the right.
/// One per screen — if a screen seems to want two, one of them is secondary.
class MPrimaryAction extends StatelessWidget {
  const MPrimaryAction({
    super.key,
    required this.label,
    required this.onPressed,
    this.marker = '→',
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final String marker;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ElevatedButton(
      onPressed: busy ? null : onPressed,
      child: Row(
        children: [
          Expanded(child: Text(label, overflow: TextOverflow.ellipsis)),
          if (busy)
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: scheme.onPrimary),
            )
          else
            Text(marker, style: M.actionLabel.copyWith(fontSize: 20)),
        ],
      ),
    );
  }
}

/// A ruled list row. Replaces `ListTile` wherever the row carries data on the right.
class MRow extends StatelessWidget {
  const MRow({
    super.key,
    required this.title,
    this.sub,
    this.leading,
    this.trailingValue,
    this.trailingLabel,
    this.trailingTone,
    this.trailing,
    this.onTap,
  });

  final String title;
  final String? sub;
  final Widget? leading;
  final String? trailingValue;
  final String? trailingLabel;
  final Color? trailingTone;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 68),
        padding: const EdgeInsets.symmetric(horizontal: M.gutter, vertical: M.s3),
        child: Row(
          children: [
            if (leading != null) ...[leading!, const SizedBox(width: 14)],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(title, style: M.row.copyWith(color: scheme.onSurface)),
                  if (sub != null) ...[
                    const SizedBox(height: 4),
                    Text(sub!, style: M.meta.copyWith(color: scheme.onSurfaceVariant)),
                  ],
                ],
              ),
            ),
            if (trailingValue != null) ...[
              const SizedBox(width: M.s3),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    trailingValue!,
                    style: M.dataSmall.copyWith(color: trailingTone ?? scheme.onSurface),
                  ),
                  if (trailingLabel != null) ...[
                    const SizedBox(height: 5),
                    Text(
                      trailingLabel!.toUpperCase(),
                      style: M.kicker.copyWith(
                        fontSize: 10,
                        letterSpacing: 0.8,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ],
            if (trailing != null) ...[const SizedBox(width: M.s3), trailing!],
            if (onTap != null && trailing == null && trailingValue == null) ...[
              const SizedBox(width: M.s2),
              Text('→', style: M.actionLabel.copyWith(fontSize: 18, color: M.inkGhost)),
            ],
          ],
        ),
      ),
    );
  }
}

/// A flush-left segmented control: one row of equal cells, 1px internal rules, no radius.
/// The active cell fills — ink normally, accent when the active value is the exception
/// (an absence, an overdue filter) that the teacher should see without reading.
class MSegmented<T> extends StatelessWidget {
  const MSegmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.accentValues = const {},
    this.height = 46,
  });

  final List<({T value, String label})> options;
  final T value;
  final ValueChanged<T> onChanged;
  final Set<T> accentValues;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: height,
      decoration: BoxDecoration(border: Border.all(color: scheme.outline)),
      child: Row(
        children: [
          for (final (i, option) in options.indexed) ...[
            if (i > 0) Container(width: 1, color: scheme.outline),
            Expanded(
              child: Semantics(
                selected: option.value == value,
                button: true,
                child: InkWell(
                  onTap: () => onChanged(option.value),
                  child: Container(
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(horizontal: 9),
                    color: option.value == value
                        ? (accentValues.contains(option.value) ? M.accent : scheme.onSurface)
                        : null,
                    child: Text(
                      option.label.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.clip,
                      style: M.label.copyWith(
                        fontSize: 11.5,
                        letterSpacing: 0.46,
                        color: option.value == value
                            ? scheme.surface
                            : scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The bottom tab bar: 2px top rule, flush-left labels, a 3px accent marker over the active
/// destination. No icons — "Fees" is clearer than any coin glyph, and four labels is the
/// ceiling before they truncate.
class MBottomBar extends StatelessWidget {
  const MBottomBar({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: scheme.outline, width: 2)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            for (final (i, label) in labels.indexed)
              Expanded(
                child: Semantics(
                  selected: i == selectedIndex,
                  button: true,
                  child: InkWell(
                    onTap: () => onSelected(i),
                    child: Container(
                      height: 58,
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 14),
                      decoration: BoxDecoration(
                        border: Border(
                          top: BorderSide(
                            color: i == selectedIndex ? M.accent : Colors.transparent,
                            width: 3,
                          ),
                          right: BorderSide(
                            color: i == labels.length - 1
                                ? Colors.transparent
                                : scheme.outlineVariant,
                          ),
                        ),
                      ),
                      child: Text(
                        label.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.clip,
                        style: M.label.copyWith(
                          fontSize: 11,
                          letterSpacing: 0.88,
                          color: i == selectedIndex ? scheme.onSurface : M.inkFaint,
                        ),
                      ),
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
