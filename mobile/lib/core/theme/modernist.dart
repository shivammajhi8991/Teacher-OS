import 'package:flutter/material.dart';

/// Modernist design-system tokens — the single source of truth for the redesign.
///
/// Ported verbatim from `_ds/modernist-*/styles.css`. Nothing in the app should hard-code a
/// hex, a font name or a raw px value that lives here. Two deliberate deviations from the
/// web spec, both for touch (documented in the handoff README):
///   * minimum tap target is [tapMin] = 44, not the web's 36px `.btn-icon`;
///   * the smallest interface label is 12px ([label]) / 11px ([kicker]) only for all-caps
///     kickers at weight 800 — the web sheet's 10px steps are never used on device.
abstract final class M {
  // ── Roles ───────────────────────────────────────────────────────────────
  static const ground = Color(0xFFF3F2F2); // --color-bg
  static const surface = Color(0xFFEAE9E9); // --color-surface
  static const ink = Color(0xFF201E1D); // --color-text
  static const accent = Color(0xFFEC3013); // --color-accent

  // ── Accent ramp ─────────────────────────────────────────────────────────
  static const accent100 = Color(0xFFFFF2EF);
  static const accent200 = Color(0xFFFFE0D9);
  static const accent300 = Color(0xFFFFC4B8);
  static const accent500 = Color(0xFFFF563C);
  static const accent600 = Color(0xFFDD2B0F); // hover
  static const accent700 = Color(0xFFAE1800); // accent-coloured text on the light ground
  static const accent800 = Color(0xFF7C1405); // text on an accent-200 fill
  static const accent900 = Color(0xFF4D170E);

  // ── Neutral ramp ────────────────────────────────────────────────────────
  static const neutral100 = Color(0xFFF8F4F4);
  static const neutral200 = Color(0xFFEAE7E7);
  static const neutral300 = Color(0xFFD7D3D3);
  static const neutral500 = Color(0xFF9B9797);
  static const neutral700 = Color(0xFF605D5D);
  static const neutral900 = Color(0xFF2D2B2B);

  // ── Rules and ink opacities ─────────────────────────────────────────────
  /// `--color-divider` — 40% ink. Always 2px, always between major sections.
  static const rule = Color(0x66201E1D);

  /// 18% ink. 1px only, and only between rows inside one section (the web
  /// sheet's own `.table td` precedent). Never used to separate sections.
  static const ruleSoft = Color(0x2E201E1D);

  static const inkMuted = Color(0xB3201E1D); // 70% — secondary copy
  static const inkFaint = Color(0x8C201E1D); // 55% — kickers, meta
  static const inkGhost = Color(0x4D201E1D); // 30% — ordinals, disabled marks

  static const onAccent = ground;

  // ── Spacing (--space-*) ─────────────────────────────────────────────────
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s6 = 24.0;
  static const s8 = 32.0;

  /// Screen edge padding. One value, everywhere, so every rule and every
  /// flush-left label lines up down the whole screen.
  static const gutter = 20.0;

  /// Minimum interactive height/width.
  static const tapMin = 44.0;

  /// Primary action height.
  static const actionHeight = 54.0;

  /// Zero. Everywhere. `--radius-md` is 0 on purpose.
  static const radius = 0.0;

  static const family = 'Archivo';

  // ── Type scale ──────────────────────────────────────────────────────────
  // letterSpacing is absolute px in Flutter; the values below are the web
  // sheet's em tracking resolved at each size.
  static const display = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 44, height: 1.02, letterSpacing: -1.32,
  );
  static const screenTitle = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 34, height: 1.0, letterSpacing: -0.85,
  );
  static const sectionTitle = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 26, height: 1.06, letterSpacing: -0.52,
  );
  static const subTitle = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 20, height: 1.1, letterSpacing: -0.3,
  );

  /// Any number the user is meant to read at a glance.
  static const data = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 24, height: 1.0,
  );
  static const dataSmall = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 17, height: 1.0,
  );

  /// All-caps section kicker. Never below 11px, never below w800.
  static const kicker = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 11, height: 1.0, letterSpacing: 1.54,
  );

  /// All-caps interface label — buttons, tabs, tags.
  static const label = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 12, height: 1.0, letterSpacing: 0.96,
  );

  /// Primary row content.
  static const row = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w400,
    fontSize: 16.5, height: 1.25,
  );
  static const body = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w400,
    fontSize: 15, height: 1.45,
  );

  /// Secondary/meta copy. The floor for anything a user must actually read.
  static const meta = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w400,
    fontSize: 12.5, height: 1.3,
  );

  static const actionLabel = TextStyle(
    fontFamily: family, fontWeight: FontWeight.w800,
    fontSize: 16, height: 1.0,
  );

  // ── Elevation ───────────────────────────────────────────────────────────
  // Modernist has no floating surfaces. Shadows exist only for the modal
  // layer; everything else is separated by a rule.
  static const shadowLg = [
    BoxShadow(color: Color(0x382D2B2B), blurRadius: 32, offset: Offset(0, 12)),
  ];
}
