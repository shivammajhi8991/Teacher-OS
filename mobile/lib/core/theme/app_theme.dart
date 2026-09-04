import 'package:flutter/material.dart';

/// docs/05 §5.8 — a small token set consumed everywhere, rather than per-screen ad hoc styling.
/// Swap [seedColor] for brand color once product/design signs off; nothing downstream references
/// a hardcoded hex.
class AppTheme {
  const AppTheme._();

  static const Color seedColor = Color(0xFF2E6F5E); // placeholder brand color

  static ThemeData light() => _themeFrom(Brightness.light);
  static ThemeData dark() => _themeFrom(Brightness.dark);

  static ThemeData _themeFrom(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(seedColor: seedColor, brightness: brightness);
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size.fromHeight(48), // large tap targets — spec §22 "fewer clicks"
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
      ),
      cardTheme: CardThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 0,
      ),
    );
  }
}

/// docs/08 §8.6 status-chip pattern — one shared mapping so attendance/payment/sync states never
/// get an ad hoc color per screen.
enum AppStatusTone { success, warning, danger, neutral, info }

extension AppStatusToneColor on AppStatusTone {
  Color color(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return switch (this) {
      AppStatusTone.success => Colors.green.shade600,
      AppStatusTone.warning => Colors.orange.shade700,
      AppStatusTone.danger => scheme.error,
      AppStatusTone.info => scheme.primary,
      AppStatusTone.neutral => scheme.onSurfaceVariant,
    };
  }
}
