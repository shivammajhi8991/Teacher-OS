import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/features/auth/presentation/screens/login_screen.dart';

// docs/05 §5.7 — "widget tests... login/registration forms (validation states...)".
void main() {
  testWidgets('shows a validation error for each empty required field on submit', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: LoginScreen()),
      ),
    );

    await tester.tap(find.widgetWithText(ElevatedButton, 'Log in'));
    await tester.pump();

    expect(find.text('Required'), findsNWidgets(2)); // identifier field + password field
  });
}
