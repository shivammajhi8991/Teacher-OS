import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/app_theme.dart';
import 'router.dart';

/// docs/05 §5.5, §5.6 — Material 3 base theme, light/dark both defined; locale list matches
/// the ARB files under lib/l10n/ (docs/03 §3.2 `users.preferred_language`: 'en' | 'hi' today,
/// extended by adding one more ARB file, no code change per docs/05 §5.6).
class TeacherOSApp extends ConsumerWidget {
  const TeacherOSApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'TeacherOS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      // TODO(l10n): once `flutter gen-l10n` has run at least once (automatic on `flutter pub get`
      // per pubspec.yaml's `generate: true`), swap this hardcoded list for the generated
      // `AppLocalizations.delegate` + `AppLocalizations.supportedLocales` from
      // `lib/l10n/app_localizations.dart` — not committed here since it's generated, not authored.
      supportedLocales: const [Locale('en'), Locale('hi')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}
