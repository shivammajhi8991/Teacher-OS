import 'package:flutter/material.dart';

/// docs/08 §8.6 — used for button-triggered actions and first loads that don't yet have a
/// screen-specific skeleton built. Prefer a real skeleton over this for list/detail screens once
/// they exist; this is the honest fallback until then.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}

/// Small inline spinner for a button mid-submit — never replaces the whole screen for an action
/// the user just triggered (docs/08 §8.6).
class InlineSpinner extends StatelessWidget {
  const InlineSpinner({super.key, this.size = 18});

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: const CircularProgressIndicator(strokeWidth: 2),
      );
}
