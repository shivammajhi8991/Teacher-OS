import 'package:flutter/material.dart';

import 'modernist.dart';

/// docs/05 §5.8 — a small token set consumed everywhere, rather than per-screen ad hoc styling.
///
/// This replaces the original `ColorScheme.fromSeed(seedColor: #2E6F5E)` placeholder theme with
/// the Modernist design system. The public API is unchanged on purpose — `AppTheme.light()`,
/// `AppTheme.dark()`, `AppStatusTone` and its `.color(context)` extension all keep their old
/// signatures, so `app/app.dart` and `core/widgets/sync_status_chip.dart` compile untouched.
///
/// Real tokens live in `modernist.dart`; this file only maps them onto Flutter's theme surface.
class AppTheme {
  const AppTheme._();

  /// Retained for source compatibility — nothing derives colours from it any more.
  @Deprecated('Modernist is a fixed palette; use tokens from modernist.dart (M.*) instead.')
  static const Color seedColor = M.accent;

  static ThemeData light() => _themeFrom(Brightness.light);
  static ThemeData dark() => _themeFrom(Brightness.dark);

  static ThemeData _themeFrom(Brightness brightness) {
    final dark = brightness == Brightness.dark;

    // Modernist is authored on a light ground. The dark variant inverts ground and ink and
    // steps the accent one stop lighter (the system's own rule for a dark ground) so the
    // primary action keeps its contrast; nothing else about the system changes.
    final ground = dark ? M.ink : M.ground;
    final ink = dark ? M.ground : M.ink;
    final surface = dark ? M.neutral900 : M.surface;
    final accent = dark ? M.accent500 : M.accent;
    final rule = dark ? const Color(0x80F3F2F2) : M.rule;

    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: accent,
      onPrimary: dark ? M.ink : M.ground,
      primaryContainer: dark ? M.accent900 : M.accent200,
      onPrimaryContainer: dark ? M.accent200 : M.accent800,
      secondary: ink,
      onSecondary: ground,
      secondaryContainer: surface,
      onSecondaryContainer: ink,
      surface: ground,
      onSurface: ink,
      surfaceContainerLowest: ground,
      surfaceContainerLow: surface,
      surfaceContainer: surface,
      surfaceContainerHigh: surface,
      surfaceContainerHighest: surface,
      onSurfaceVariant: dark ? const Color(0xB3F3F2F2) : M.inkMuted,
      outline: rule,
      outlineVariant: dark ? const Color(0x40F3F2F2) : M.ruleSoft,
      error: dark ? M.accent500 : M.accent700,
      onError: ground,
      errorContainer: dark ? M.accent900 : M.accent200,
      onErrorContainer: dark ? M.accent200 : M.accent800,
      shadow: M.ink,
      scrim: M.ink,
      inverseSurface: ink,
      onInverseSurface: ground,
      inversePrimary: accent,
    );

    TextStyle t(TextStyle s) => s.copyWith(color: ink);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: ground,
      canvasColor: ground,
      fontFamily: M.family,
      splashFactory: InkSparkle.splashFactory,

      // Zero radius, everywhere, for every generated surface.
      cardTheme: CardThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        titleTextStyle: t(M.subTitle),
        contentTextStyle: t(M.body),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: ground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: ink,
        contentTextStyle: M.label.copyWith(color: ground, letterSpacing: 0.7),
        behavior: SnackBarBehavior.fixed,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      ),

      // Rules do the organising. 2px is the section rule; MRuleSoft handles row rules.
      dividerTheme: DividerThemeData(color: rule, thickness: 2, space: 2),

      appBarTheme: AppBarTheme(
        backgroundColor: ground,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: M.gutter,
        toolbarHeight: 64,
        titleTextStyle: t(M.screenTitle),
        iconTheme: IconThemeData(color: ink, size: 22),
      ),

      // Flush-left labels: a button wider than its label starts at the left padding edge.
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: dark ? M.ink : M.ground,
          disabledBackgroundColor: accent.withValues(alpha: 0.45),
          elevation: 0,
          minimumSize: const Size.fromHeight(M.actionHeight),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          textStyle: M.actionLabel,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: dark ? M.ink : M.ground,
          minimumSize: const Size.fromHeight(M.actionHeight),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          textStyle: M.actionLabel,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          minimumSize: const Size.fromHeight(52),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          textStyle: M.actionLabel.copyWith(fontSize: 15),
          side: BorderSide(color: rule),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: dark ? accent : M.accent700,
          minimumSize: const Size(M.tapMin, M.tapMin),
          textStyle: M.label,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: ink,
          minimumSize: const Size.square(M.tapMin),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        isDense: false,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        labelStyle: M.label.copyWith(color: dark ? const Color(0xB3F3F2F2) : M.inkFaint),
        floatingLabelStyle: M.label.copyWith(color: dark ? accent : M.accent700),
        hintStyle: M.body.copyWith(color: dark ? const Color(0x80F3F2F2) : M.inkFaint),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: rule),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: rule),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: accent, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: colorScheme.error, width: 2),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: Colors.transparent,
        selectedColor: ink,
        checkmarkColor: ground,
        labelStyle: M.label.copyWith(color: ink),
        secondaryLabelStyle: M.label.copyWith(color: ground),
        side: BorderSide(color: rule),
        showCheckmark: false,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      ),

      // The redesign ships its own MBottomBar (flush-left labels, 3px accent marker on the
      // active destination). This entry only keeps a stock NavigationBar from looking foreign
      // wherever one survives.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: ground,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        indicatorShape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        height: 62,
        elevation: 0,
        labelTextStyle: WidgetStatePropertyAll(M.label.copyWith(color: ink)),
        iconTheme: WidgetStatePropertyAll(IconThemeData(color: ink, size: 22)),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),

      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: M.gutter, vertical: M.s2),
        minVerticalPadding: M.s3,
        titleTextStyle: t(M.row),
        subtitleTextStyle: M.meta.copyWith(color: dark ? const Color(0xB3F3F2F2) : M.inkFaint),
        iconColor: ink,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: accent,
        linearMinHeight: 3,
        linearTrackColor: dark ? const Color(0x40F3F2F2) : M.ruleSoft,
      ),

      textSelectionTheme: TextSelectionThemeData(
        cursorColor: accent,
        selectionColor: accent.withValues(alpha: 0.3),
        selectionHandleColor: accent,
      ),

      textTheme: TextTheme(
        displayLarge: t(M.display),
        displayMedium: t(M.screenTitle),
        headlineLarge: t(M.screenTitle),
        headlineMedium: t(M.sectionTitle),
        headlineSmall: t(M.sectionTitle),
        titleLarge: t(M.subTitle),
        titleMedium: t(M.subTitle.copyWith(fontSize: 17)),
        titleSmall: t(M.label),
        bodyLarge: t(M.row),
        bodyMedium: t(M.body),
        bodySmall: M.meta.copyWith(color: dark ? const Color(0xB3F3F2F2) : M.inkFaint),
        labelLarge: t(M.actionLabel),
        labelMedium: t(M.label),
        labelSmall: t(M.kicker),
      ),
    );
  }
}

/// docs/08 §8.6 status-chip pattern — one shared mapping so attendance/payment/sync states never
/// get an ad hoc colour per screen.
///
/// Modernist is a mono palette: there is no green and no orange in the system. State is carried
/// by fill and label, not hue — `success` and `info` read as plain ink, and only genuine
/// exceptions (money late, a save that failed) reach for the accent ramp. Callers are unchanged.
enum AppStatusTone { success, warning, danger, neutral, info }

extension AppStatusToneColor on AppStatusTone {
  Color color(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return switch (this) {
      AppStatusTone.success => dark ? M.ground : M.ink,
      AppStatusTone.warning => dark ? M.accent500 : M.accent700,
      AppStatusTone.danger => dark ? M.accent500 : M.accent,
      AppStatusTone.info => dark ? M.ground : M.ink,
      AppStatusTone.neutral => dark ? const Color(0x8CF3F2F2) : M.inkFaint,
    };
  }

  /// Fill for a tag carrying this tone. Ink-on-tint, per the system's tag classes.
  Color fill(BuildContext context) => switch (this) {
        AppStatusTone.warning || AppStatusTone.danger => M.accent200,
        _ => M.surface,
      };

  Color onFill(BuildContext context) => switch (this) {
        AppStatusTone.warning || AppStatusTone.danger => M.accent800,
        _ => M.inkMuted,
      };
}
