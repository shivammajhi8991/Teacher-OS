import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Loads the real Archivo font before any widget test runs.
///
/// Flutter's test harness never reads `pubspec.yaml`'s `fonts:` block — every widget test
/// renders text with a fallback test font unless a real one is explicitly loaded here, per
/// Flutter's own documented pattern for this file. This matters for the Modernist design system
/// (`design_handoff_modernist/README.md`) specifically: every `M.*` type-scale value
/// (`fontSize`/`height`/`letterSpacing`) is tuned against Archivo's real glyph metrics, so a
/// fallback font's different metrics can produce layout failures (e.g. a `RenderFlex` overflow)
/// that never happen on a real device — a false positive, not a real bug, and not something to
/// "fix" by changing a design token. Loading the actual font here is what makes this repo's
/// widget tests trustworthy for anything Modernist-themed, not just this one screen.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  setUpAll(() async {
    final fontData = ByteData.sublistView(
      await File('assets/fonts/Archivo-Variable.ttf').readAsBytes(),
    );
    final loader = FontLoader('Archivo')..addFont(Future.value(fontData));
    await loader.load();
  });

  await testMain();
}
