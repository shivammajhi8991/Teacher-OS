import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../providers/auth_providers.dart';

/// docs/08 §8.5 "Teacher onboarding" flow's entry point; docs/05 §5.3 router redirects here
/// whenever [AuthNotifier]'s state is [AuthUnauthenticated].
///
/// Modernist redesign (design_handoff_modernist/README.md's "Login" row): "Kicker on the ground,
/// then a full-bleed accent poster block with the statement at M.display in M.ground; fields;
/// MPrimaryAction 'Log in'; OutlinedButton 'Create an account'." Recreated pixel-for-pixel against
/// TeacherOS Redesign.dc.html's own LOGIN section, including its exact four-line statement.
///
/// One line from the prototype is deliberately not here: "Forgot your password?" There is no
/// password-reset capability anywhere in this system yet — no mobile screen, no backend endpoint,
/// nothing an admin can trigger either — so wiring it to a route or even a "contact your admin"
/// message would promise something that doesn't exist. Left out rather than built as dead UI.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ref.read(authNotifierProvider.notifier).login(
          identifier: _identifierController.text.trim(),
          password: _passwordController.text,
        );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) => setState(() => _isSubmitting = false), // router redirect handles navigation
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s1, M.gutter, M.s3),
              child: Text(
                'Teacher operating system'.toUpperCase(),
                style: M.kicker.copyWith(letterSpacing: 1.54, color: scheme.onSurfaceVariant),
              ),
            ),
            Container(
              color: M.accent,
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s6, M.gutter, M.s8),
              child: Text(
                'Run the\nteaching,\nnot the\npaperwork.',
                style: M.display.copyWith(color: M.onAccent),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s6, M.gutter, M.s6),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ModernistField(
                      label: 'Email or phone',
                      controller: _identifierController,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.username],
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: M.s4),
                    _ModernistField(
                      label: 'Password',
                      controller: _passwordController,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      validator: (value) => (value == null || value.isEmpty) ? 'Required' : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: M.s3),
                      Text(_errorMessage!, style: M.body.copyWith(color: scheme.error)),
                    ],
                    const SizedBox(height: M.s6),
                    MPrimaryAction(
                      label: 'Log in',
                      onPressed: _isSubmitting ? null : _submit,
                      busy: _isSubmitting,
                    ),
                    const SizedBox(height: M.s2),
                    SizedBox(
                      width: double.infinity,
                      height: M.actionHeight,
                      child: OutlinedButton(
                        onPressed: () => context.go('/register'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: scheme.onSurface,
                          padding: const EdgeInsets.symmetric(horizontal: M.s4),
                          alignment: Alignment.centerLeft,
                        ),
                        child: const Text('Create an account', style: M.actionLabel),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The kicker-label-above / bordered-surface-box field shape the prototype uses for every text
/// input across Login, Onboarding, and (already shipped) Record Payment's amount field — a plain
/// Material `TextFormField` keeps its own floating label, which doesn't match. Screen-local by
/// the same precedent as `record_payment_screen.dart`'s own private widgets: not promoted into
/// `modernist_primitives.dart`.
class _ModernistField extends StatelessWidget {
  const _ModernistField({
    required this.label,
    required this.controller,
    this.obscureText = false,
    this.keyboardType,
    this.autofillHints,
    this.validator,
    this.onFieldSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final bool obscureText;
  final TextInputType? keyboardType;
  final List<String>? autofillHints;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: M.s2),
        Container(
          constraints: const BoxConstraints(minHeight: 50),
          padding: const EdgeInsets.symmetric(horizontal: M.s3, vertical: M.s2),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerLow,
            border: Border.all(color: scheme.outline),
          ),
          child: TextFormField(
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            autofillHints: autofillHints,
            validator: validator,
            onFieldSubmitted: onFieldSubmitted,
            style: M.row.copyWith(color: scheme.onSurface),
            decoration: const InputDecoration(
              border: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),
      ],
    );
  }
}
