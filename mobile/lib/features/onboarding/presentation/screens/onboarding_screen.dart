import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../domain/entities/teacher_category.dart';
import '../providers/teacher_profile_providers.dart';

/// docs/08 §8.5 "Teacher onboarding": category grid → progressive profile form (Basics /
/// Teaching details / Fees & availability). Reached only right after a fresh teacher
/// registration (docs/07 Phase 4 step 2) — see app/router.dart and register_screen.dart.
///
/// Modernist redesign (design_handoff_modernist/README.md's "Onboarding" row): "Drop Flutter's
/// Stepper for a 4-segment progress rule + 'STEP 1 OF 4' kicker + a 2-column category grid (2px
/// rules, selected cell fills ink). Also finish step 4 — it is currently an empty state, not a
/// form." The progress rule, kicker, and category grid are built to the prototype's own ONBOARDING
/// section pixel-for-pixel; the category grid drops the prototype's per-item hint text
/// (`{{ c.hint }}`) because the real `TeacherCategory` entity has no such field — never fabricated.
///
/// "Finish step 4" doesn't mean building a fee-structure/availability form: the backend's own
/// `CreateTeacherProfileDto` (create-teacher-profile.dto.ts) comments that fee defaults
/// deliberately "stay off this DTO" — fee structures are created per-class after onboarding, and
/// there's no "availability" field anywhere in this API. Every field that DTO does accept is
/// already collected by steps 1–3. So step 4 becomes a real Review — every field entered so far,
/// editable via Back, then Finish submits the exact same `createProfile` call as before. That
/// replaces the old passive "coming soon" `EmptyState` with something that actually does
/// something, which is what "finish" means when there's nothing left to collect.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _currentStep = 0;
  static const _stepCount = 4;

  String? _selectedCategoryId;
  String? _selectedCategoryName;
  final _headlineController = TextEditingController();
  final _bioController = TextEditingController();
  final _experienceYearsController = TextEditingController();
  final _serviceAreaController = TextEditingController();
  String _teachingMode = 'both';
  final _subjectsController = TextEditingController();
  final _classDurationController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _headlineController.dispose();
    _bioController.dispose();
    _experienceYearsController.dispose();
    _serviceAreaController.dispose();
    _subjectsController.dispose();
    _classDurationController.dispose();
    super.dispose();
  }

  bool get _canContinue => _currentStep == 0 ? _selectedCategoryId != null : true;

  Future<void> _handleContinue() async {
    if (!_canContinue) return;
    if (_currentStep < _stepCount - 1) {
      setState(() => _currentStep += 1);
      return;
    }
    await _submit();
  }

  void _handleBack() {
    if (_currentStep == 0) return;
    setState(() => _currentStep -= 1);
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final subjectsOrSkills = _subjectsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .map((name) => (name: name, level: null as String?))
        .toList();

    final result = await ref.read(createTeacherProfileUseCaseProvider).call(
          teacherCategoryId: _selectedCategoryId!,
          headline: _headlineController.text.trim().isEmpty ? null : _headlineController.text.trim(),
          bio: _bioController.text.trim().isEmpty ? null : _bioController.text.trim(),
          experienceYears: int.tryParse(_experienceYearsController.text.trim()),
          serviceArea:
              _serviceAreaController.text.trim().isEmpty ? null : _serviceAreaController.text.trim(),
          teachingMode: _teachingMode,
          subjectsOrSkills: subjectsOrSkills,
          classDurationMinutesDefault: int.tryParse(_classDurationController.text.trim()),
        );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) {
        setState(() => _isSubmitting = false);
        context.go('/teacher'); // matches docs/08 §8.1 Teacher shell landing
      },
    );
  }

  ({String title, String? description, String note}) get _stepCopy => switch (_currentStep) {
        0 => (
            title: 'What do you teach?',
            description:
                'This sets your default class length, the fee cycle and which progress metrics '
                'you get.',
            note: 'Next: your name and headline, then subjects and class length, then a final '
                'review. You can finish in under a minute and add more from your profile later.',
          ),
        1 => (
            title: 'Tell us about you',
            description: null,
            note: 'Every field here is optional — add what you have, skip the rest.',
          ),
        2 => (
            title: 'Teaching details',
            description: null,
            note: 'Subjects help parents and students find you; class length just sets a '
                'sensible default when you create a new class.',
          ),
        _ => (
            title: 'Review',
            description: null,
            note: 'Tap Back to change anything before you finish.',
          ),
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final copy = _stepCopy;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(M.gutter, M.s3, M.gutter, M.s6),
          children: [
            _ProgressRule(stepCount: _stepCount, currentStep: _currentStep),
            const SizedBox(height: M.s4),
            Text(
              'Step ${_currentStep + 1} of $_stepCount'.toUpperCase(),
              style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: M.s2),
            Text(copy.title, style: M.screenTitle),
            if (copy.description != null) ...[
              const SizedBox(height: M.s2),
              Text(copy.description!, style: M.body.copyWith(color: scheme.onSurfaceVariant)),
            ],
            const SizedBox(height: M.s4),
            switch (_currentStep) {
              0 => _CategoryStep(
                  selectedId: _selectedCategoryId,
                  onSelected: (category) => setState(() {
                    _selectedCategoryId = category.id;
                    _selectedCategoryName = category.name;
                  }),
                ),
              1 => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ModernistField(label: 'Headline', controller: _headlineController),
                    const SizedBox(height: M.s4),
                    _ModernistField(label: 'About you', controller: _bioController, maxLines: 3),
                    const SizedBox(height: M.s4),
                    _ModernistField(
                      label: 'Years of experience',
                      controller: _experienceYearsController,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: M.s4),
                    _ModernistField(
                      label: 'Service area / location',
                      controller: _serviceAreaController,
                    ),
                  ],
                ),
              2 => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Teaching mode'.toUpperCase(),
                      style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: M.s2),
                    MSegmented<String>(
                      options: const [
                        (value: 'online', label: 'Online'),
                        (value: 'offline', label: 'Offline'),
                        (value: 'both', label: 'Both'),
                      ],
                      value: _teachingMode,
                      onChanged: (v) => setState(() => _teachingMode = v),
                    ),
                    const SizedBox(height: M.s4),
                    _ModernistField(
                      label: 'Subjects or skills',
                      controller: _subjectsController,
                    ),
                    const SizedBox(height: M.s4),
                    _ModernistField(
                      label: 'Default class duration (minutes)',
                      controller: _classDurationController,
                      keyboardType: TextInputType.number,
                    ),
                  ],
                ),
              _ => _ReviewStep(
                  categoryName: _selectedCategoryName,
                  headline: _headlineController.text.trim(),
                  bio: _bioController.text.trim(),
                  experienceYears: _experienceYearsController.text.trim(),
                  serviceArea: _serviceAreaController.text.trim(),
                  teachingMode: _teachingMode,
                  subjects: _subjectsController.text.trim(),
                  classDuration: _classDurationController.text.trim(),
                ),
            },
            if (_errorMessage != null) ...[
              const SizedBox(height: M.s3),
              Text(_errorMessage!, style: M.body.copyWith(color: scheme.error)),
            ],
            const SizedBox(height: M.s6),
            MPrimaryAction(
              label: _currentStep == _stepCount - 1 ? 'Finish' : 'Continue',
              onPressed: _isSubmitting || !_canContinue ? null : _handleContinue,
              busy: _isSubmitting,
            ),
            if (_currentStep > 0) ...[
              const SizedBox(height: M.s3),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(onPressed: _isSubmitting ? null : _handleBack, child: const Text('BACK')),
              ),
            ],
            const SizedBox(height: M.s3),
            Text(copy.note, style: M.meta.copyWith(color: scheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

/// The 4-segment progress rule: `stepCount` equal-width 4px bars, filled `M.accent` up to and
/// including the current step, `M.ruleSoft` beyond it.
class _ProgressRule extends StatelessWidget {
  const _ProgressRule({required this.stepCount, required this.currentStep});

  final int stepCount;
  final int currentStep;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        for (var i = 0; i < stepCount; i++) ...[
          if (i > 0) const SizedBox(width: M.s1),
          Expanded(
            child: Container(
              height: 4,
              color: i <= currentStep ? M.accent : scheme.outlineVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _CategoryStep extends ConsumerWidget {
  const _CategoryStep({required this.selectedId, required this.onSelected});

  final String? selectedId;
  final ValueChanged<TeacherCategory> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(teacherCategoriesProvider);

    return categoriesAsync.when(
      loading: () => const SizedBox(height: 200, child: LoadingView()),
      error: (error, stackTrace) => ErrorView(
        failure: UnexpectedFailure(message: error.toString()),
        onRetry: () => ref.invalidate(teacherCategoriesProvider),
      ),
      data: (result) => result.fold(
        (failure) => ErrorView(
          failure: failure,
          onRetry: () => ref.invalidate(teacherCategoriesProvider),
        ),
        (categories) => categories.isEmpty
            ? const EmptyState(message: 'No categories available yet.')
            : _CategoryGrid(
                categories: categories,
                selectedId: selectedId,
                onSelected: onSelected,
              ),
      ),
    );
  }
}

/// The 2-column category grid: `border-top` + `border-left` 2px on the container, each cell
/// carrying its own `border-right` + `border-bottom` — the standard technique for a shared-rule
/// grid, matching `MStatCells`' own internal-rule approach. Paired into rows of two so an odd
/// final category still closes the grid with a blank, still-bordered cell rather than a dangling
/// edge.
class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({required this.categories, required this.selectedId, required this.onSelected});

  final List<TeacherCategory> categories;
  final String? selectedId;
  final ValueChanged<TeacherCategory> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rows = <List<TeacherCategory?>>[];
    for (var i = 0; i < categories.length; i += 2) {
      rows.add([categories[i], i + 1 < categories.length ? categories[i + 1] : null]);
    }

    return Container(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: scheme.outline, width: 2),
          left: BorderSide(color: scheme.outline, width: 2),
        ),
      ),
      child: Column(
        children: [
          for (final row in rows)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final category in row)
                    Expanded(
                      child: category == null
                          ? Container(
                              decoration: BoxDecoration(
                                border: Border(
                                  right: BorderSide(color: scheme.outline, width: 2),
                                  bottom: BorderSide(color: scheme.outline, width: 2),
                                ),
                              ),
                            )
                          : _CategoryCell(
                              category: category,
                              selected: category.id == selectedId,
                              onTap: () => onSelected(category),
                            ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _CategoryCell extends StatelessWidget {
  const _CategoryCell({required this.category, required this.selected, required this.onTap});

  final TeacherCategory category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.all(M.s4),
          decoration: BoxDecoration(
            color: selected ? scheme.onSurface : null,
            border: Border(
              right: BorderSide(color: scheme.outline, width: 2),
              bottom: BorderSide(color: scheme.outline, width: 2),
            ),
          ),
          child: Text(
            category.name,
            style: M.row.copyWith(color: selected ? scheme.surface : scheme.onSurface),
          ),
        ),
      ),
    );
  }
}

/// The final step's real content — every field entered in steps 1–3, shown back for a check
/// before Finish submits. Empty optional fields are omitted rather than shown as blank, matching
/// this whole redesign's established `_DetailRow`/`_FactRow` precedent.
class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.categoryName,
    required this.headline,
    required this.bio,
    required this.experienceYears,
    required this.serviceArea,
    required this.teachingMode,
    required this.subjects,
    required this.classDuration,
  });

  final String? categoryName;
  final String headline;
  final String bio;
  final String experienceYears;
  final String serviceArea;
  final String teachingMode;
  final String subjects;
  final String classDuration;

  String get _teachingModeLabel => switch (teachingMode) {
        'online' => 'Online',
        'offline' => 'Offline',
        _ => 'Both',
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final facts = <(String, String)>[
      if (categoryName != null) ('Category', categoryName!),
      if (headline.isNotEmpty) ('Headline', headline),
      if (bio.isNotEmpty) ('About you', bio),
      if (experienceYears.isNotEmpty) ('Experience', '$experienceYears yrs'),
      if (serviceArea.isNotEmpty) ('Service area', serviceArea),
      ('Teaching mode', _teachingModeLabel),
      if (subjects.isNotEmpty) ('Subjects', subjects),
      if (classDuration.isNotEmpty) ('Class duration', '$classDuration min'),
    ];

    return Container(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: scheme.outline, width: 2))),
      child: Column(
        children: [
          for (final (i, fact) in facts.indexed) ...[
            if (i > 0)
              Container(height: 1, color: scheme.outlineVariant),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: M.s3),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 120,
                    child: Text(
                      fact.$1.toUpperCase(),
                      style: M.kicker.copyWith(letterSpacing: 1.1, color: scheme.onSurfaceVariant),
                    ),
                  ),
                  Expanded(child: Text(fact.$2, style: M.body)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The kicker-label-above / bordered-surface-box field shape shared with `login_screen.dart`'s
/// own private `_ModernistField` — duplicated rather than shared, matching this whole redesign's
/// established precedent for small screen-local structural widgets.
class _ModernistField extends StatelessWidget {
  const _ModernistField({
    required this.label,
    required this.controller,
    this.keyboardType,
    this.maxLines = 1,
  });

  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: M.s2),
        Container(
          constraints: const BoxConstraints(minHeight: 50),
          padding: const EdgeInsets.symmetric(horizontal: M.s3, vertical: M.s2),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerLow,
            border: Border.all(color: scheme.outline),
          ),
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            maxLines: maxLines,
            style: M.row.copyWith(color: scheme.onSurface),
            decoration: const InputDecoration(
              border: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),
      ],
    );
  }
}
