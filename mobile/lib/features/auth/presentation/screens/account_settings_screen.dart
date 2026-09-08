import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_providers.dart';

/// docs/01 §1.3 self-service data export / account deletion (Phase 6) — the in-app screen those
/// endpoints needed to actually satisfy Apple's App Review Guideline 5.1.1(v) (account deletion
/// reachable *from within the app*, not just via a raw API call). Wired into the Teacher shell's
/// More menu for now (docs/08 §8.1's own "Settings has no screen anywhere yet" note); Student/
/// Parent/Institute Admin's own Profile/Settings tab placeholders would just point here too, the
/// same one-line wiring — not done in this pass, named rather than silently deferred.
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
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.download_outlined),
            title: const Text('Export my data'),
            subtitle: const Text('Download a copy of your account data'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _exportData(context, ref),
          ),
          const Divider(height: 1),
          ListTile(
            leading: Icon(Icons.delete_outline, color: Theme.of(context).colorScheme.error),
            title: Text(
              'Delete my account',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            subtitle: const Text('Permanently sign out and delete this account'),
            onTap: () => _confirmAndDeleteAccount(context, ref),
          ),
        ],
      ),
    );
  }
}
