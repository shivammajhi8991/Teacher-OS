import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';

/// Single entry point so `main.dart` stays a one-liner and any future pre-run init (crash
/// reporting per docs/02 §2.7, Drift database open per docs/05 §5.4) has one obvious home.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: TeacherOSApp()));
}
