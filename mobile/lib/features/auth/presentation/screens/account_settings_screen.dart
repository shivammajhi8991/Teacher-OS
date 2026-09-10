import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../providers/auth_providers.dart';
import '../providers/auth_state.dart';

/// docs/01 §1.3 self-service data export / account deletion (Phase 6) — the in-app screen those
/// endpoints needed to actually satisfy Apple's App Review Guideline 5.1.1(v) (account deletion
/// reachable *from within the app*, not just via a raw API call).
///
/// Modernist redesign: wired into every role's Profile/Settings tab now, not just the Teacher
/// shell's More menu — `account_settings_screen.dart`'s own prior doc comment named this
/// explicitly as "not done in this pass" for Student/Parent/Institute Admin, and it's the same
/// one-line wiring for each. Body restyled to M.* tokens/primitives; the two dialogs
/// (export's JSON viewer, delete's password-confirm) are left as plain `AlertDialog`s,
/// matching this whole redesign's own precedent of leaving confirm dialogs in Material rather
/// than rebuilding them (Student Detail's archive/add-guardian dialogs, Record Payment's none —
/// the system's own widgets are screen primitives, not a dialog-chrome replacement).
///
/// This screen carries no Scaffold/AppBar of its own — it's pure content, same shape as
/// `ParentFeesTab`/`FeesOverviewScreen` — so it drops cleanly into a tabBuilder for Student/
/// Parent/Institute Admin. The Teacher shell still reaches it by *pushing* it from
/// `MoreMenuScreen`, which supplies its own Scaffold+AppBar wrapper at the push site instead,
/// the same pattern `_ParentHomeExtra` already uses to push the tab-shaped `ParentFeesTab`.
class AccountSettingsScreen extends ConsumerWidget {
  const AccountSettingsScreen({super.key});

  Future<void> _exportData(BuildContext context, WidgetRef ref) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );
    final result = await ref.read(authRepositoryProvider).exportAccountData();
    if (!context.mounted) return;
    Navigator.of(context).pop(); // close the loading dialog

    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (data) => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Your account data'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: SelectableText(const JsonEncoder.withIndent('  ').convert(data)),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmAndDeleteAccount(BuildContext context, WidgetRef ref) async {
    final passwordController = TextEditingController();
    final password = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete your account?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This cannot be undone. You will be signed out of every device, and this '
              'email/phone can be used to register a new account afterward. Enter your '
              'password to confirm.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: passwordController,
              obscureText: true,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Password'),
              onSubmitted: (value) => Navigator.of(context).pop(value),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.of(context).pop(passwordController.text),
            child: const Text('Delete account'),
          ),
        ],
      ),
    );
    if (password == null || password.isEmpty) return; // cancelled

    final result =
        await ref.read(authNotifierProvider.notifier).deleteAccount(password: password);
    if (!context.mounted) return;
    // On success, AuthNotifier's state flip to AuthUnauthenticated already sends the router to
    // /login (docs/05 §5.3) — nothing else to do here. Only a failure needs handling.
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) {},
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final authState = ref.watch(authNotifierProvider);
    final user = authState is AuthAuthenticated ? authState.user : null;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        if (user != null) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.fullName, style: M.sectionTitle),
                      const SizedBox(height: M.s2),
                      Text(
                        user.email ?? user.phone ?? '',
                        style: M.body.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                MTag(user.activeRole.replaceAll('_', ' ')),
              ],
            ),
          ),
        ],
        const MRule(),
        const MSectionLabel('Your data'),
        MRow(
          title: 'Export my data',
          sub: 'Download a copy of your account data',
          onTap: () => _exportData(context, ref),
        ),
        const MRule(),
        const MSectionLabel('Danger zone'),
        MRow(
          title: 'Delete my account',
          sub: 'Permanently sign out and delete this account',
          onTap: () => _confirmAndDeleteAccount(context, ref),
        ),
        const SizedBox(height: M.s6),
      ],
    );
  }
}
