import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:teacheros/app/app.dart';

// docs/05 §5.7 lists "Registration/Login" as a critical end-to-end workflow. Requires the real
// backend running and reachable (see backend/README.md) — pass its address with
// `flutter test integration_test/auth_flow_test.dart --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1`
// on an Android emulator (localhost inside the emulator is 10.0.2.2, not the host machine).
// Not run by `flutter test` (that only picks up test/) — matches docs/05 §5.7's "integration
// tests run on a nightly/pre-release pipeline against a real emulator/simulator" policy.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('registers a new teacher, lands on the teacher dashboard, and can log out', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: TeacherOSApp()));
    await tester.pumpAndSettle();

    // Starts on /login (docs/05 §5.3 redirect) — navigate to /register.
    await tester.tap(find.text("Don't have an account? Register"));
    await tester.pumpAndSettle();

    final uniqueEmail = 'integration-${DateTime.now().millisecondsSinceEpoch}@example.com';
    await tester.enterText(find.widgetWithText(TextFormField, 'Full name'), 'Integration Teacher');
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), uniqueEmail);
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse-battery');

    await tester.tap(find.widgetWithText(ElevatedButton, 'Create account'));
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // Redirected to /teacher (docs/08 §8.1 Teacher shell) on success.
    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.text('Classes'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.logout));
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsOneWidget); // back on /login
  });
}
