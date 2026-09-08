import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/onboarding/domain/entities/teacher_category.dart';
import 'package:teacheros/features/onboarding/domain/entities/teacher_profile.dart';
import 'package:teacheros/features/onboarding/domain/repositories/teacher_profile_repository.dart';
import 'package:teacheros/features/onboarding/presentation/providers/teacher_profile_providers.dart';
import 'package:teacheros/features/onboarding/presentation/screens/onboarding_screen.dart';

class _FakeTeacherProfileRepository implements TeacherProfileRepository {
  @override
  Future<Result<List<TeacherCategory>>> listCategories() async {
    return const Ok([
      TeacherCategory(id: 'cat-music', name: 'Music Teacher', slug: 'music-teacher'),
      TeacherCategory(id: 'cat-sports', name: 'Sports Coach', slug: 'sports-coach'),
    ]);
  }

  @override
  Future<Result<TeacherProfile>> createProfile({
    required String teacherCategoryId,
    String? headline,
    String? bio,
    int? experienceYears,
    String? serviceArea,
    required String teachingMode,
    List<({String name, String? level})> subjectsOrSkills = const [],
    int? classDurationMinutesDefault,
  }) async {
    return Ok(TeacherProfile(
      id: 'new-profile',
      teacherCategoryId: teacherCategoryId,
      teachingMode: teachingMode,
      verificationStatus: 'unverified',
    ));
  }
}

// docs/05 §5.7 — widget test for a critical onboarding step: the category grid renders from the
// repository and selecting a category unlocks moving through the rest of the form.
//
// Modernist redesign (design_handoff_modernist/README.md): Flutter's `Stepper` (and its
// `FilledButton` controls) is gone, replaced by a single `MPrimaryAction` — an `ElevatedButton` —
// per step, and step 2's field labels are now separate kicker `Text` widgets above each
// `TextField` rather than the field's own `decoration.labelText`. Rewritten below against both,
// and extended all the way to the new step 4 ("Review", replacing the old empty state, which
// used to be where this test stopped) — new behaviour this pass adds, not just a restyle of what
// step 2 already tested. Stops short of tapping Finish: on success, `_submit` calls
// `context.go('/teacher')`, which needs a real `GoRouter` ancestor this plain-`MaterialApp` test
// harness doesn't set up (no test in this suite does) — that submit call itself is unchanged
// from before this pass and isn't what changed here.
void main() {
  testWidgets('walks Category through Basics and Teaching details to the new Review step', (
    tester,
  ) async {
    final fakeRepository = _FakeTeacherProfileRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [teacherProfileRepositoryProvider.overrideWithValue(fakeRepository)],
        child: const MaterialApp(home: OnboardingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    // Step 1 — Category: renders from the repository; Continue is disabled until one is picked.
    expect(find.text('Music Teacher'), findsOneWidget);
    expect(find.text('Sports Coach'), findsOneWidget);
    final continueButton = find.widgetWithText(ElevatedButton, 'Continue');
    expect(tester.widget<ElevatedButton>(continueButton).onPressed, isNull);

    await tester.tap(find.text('Music Teacher'));
    await tester.pumpAndSettle();
    await tester.tap(continueButton);
    await tester.pumpAndSettle();

    // Step 2 — Basics: kicker labels sit above plain TextFields now, not as labelText.
    expect(find.text('HEADLINE'), findsOneWidget);
    await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
    await tester.pumpAndSettle();

    // Step 3 — Teaching details: MSegmented replaces the old SegmentedButton, defaulting to Both.
    expect(find.text('SUBJECTS OR SKILLS'), findsOneWidget);
    await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
    await tester.pumpAndSettle();

    // Step 4 — Review: the old empty state is gone; the picked category shows back for a check.
    expect(find.text('Review'), findsOneWidget);
    expect(find.text('Music Teacher'), findsOneWidget);
    expect(find.text('Both'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Finish'), findsOneWidget);
  });
}
