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
// repository and selecting a category unlocks moving to the next step of the form.
void main() {
  testWidgets('renders seeded categories and advances to Basics once one is selected', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          teacherProfileRepositoryProvider.overrideWithValue(_FakeTeacherProfileRepository()),
        ],
        child: const MaterialApp(home: OnboardingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Music Teacher'), findsOneWidget);
    expect(find.text('Sports Coach'), findsOneWidget);

    await tester.tap(find.text('Music Teacher'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Continue'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextField, 'Headline (e.g. "Classical guitar, 8 yrs experience")'),
        findsOneWidget);
  });
}
