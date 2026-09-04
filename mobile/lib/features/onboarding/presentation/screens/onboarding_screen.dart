import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/teacher_category.dart';
import '../providers/teacher_profile_providers.dart';

/// docs/08 §8.5 "Teacher onboarding": category grid → progressive profile form (Basics /
/// Teaching details / Fees & availability). Reached only right after a fresh teacher
/// registration (docs/07 Phase 4 step 2) — see app/router.dart and register_screen.dart.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _currentStep = 0;

  String? _selectedCategoryId;
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

  bool get _canContinueFromCategoryStep => _selectedCategoryId != null;

  Future<void> _handleContinue() async {
    if (_currentStep == 0 && !_canContinueFromCategoryStep) return;
    if (_currentStep < 3) {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set up your teaching profile')),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: _isSubmitting ? null : _handleContinue,
        onStepCancel: _currentStep == 0 ? null : _handleBack,
        controlsBuilder: (context, details) => Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Row(
            children: [
              FilledButton(
                onPressed: details.onStepContinue,
                child: _isSubmitting
                    ? const InlineSpinner()
                    : Text(_currentStep == 3 ? 'Finish' : 'Continue'),
              ),
              if (details.onStepCancel != null) ...[
                const SizedBox(width: 8),
                TextButton(onPressed: details.onStepCancel, child: const Text('Back')),
              ],
            ],
          ),
        ),
        steps: [
          Step(
            title: const Text('Category'),
            isActive: _currentStep >= 0,
            state: _currentStep > 0 ? StepState.complete : StepState.indexed,
            content: _CategoryStep(
              selectedId: _selectedCategoryId,
              onSelected: (id) => setState(() => _selectedCategoryId = id),
            ),
          ),
          Step(
            title: const Text('Basics'),
            isActive: _currentStep >= 1,
            state: _currentStep > 1 ? StepState.complete : StepState.indexed,
            content: Column(
              children: [
                TextField(
                  controller: _headlineController,
                  decoration: const InputDecoration(labelText: 'Headline (e.g. "Classical guitar, 8 yrs experience")'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _bioController,
                  decoration: const InputDecoration(labelText: 'About you'),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _experienceYearsController,
                  decoration: const InputDecoration(labelText: 'Years of experience'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _serviceAreaController,
                  decoration: const InputDecoration(labelText: 'Service area / location'),
                ),
              ],
            ),
          ),
          Step(
            title: const Text('Teaching details'),
            isActive: _currentStep >= 2,
            state: _currentStep > 2 ? StepState.complete : StepState.indexed,
            content: Column(
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'online', label: Text('Online')),
                      ButtonSegment(value: 'offline', label: Text('Offline')),
                      ButtonSegment(value: 'both', label: Text('Both')),
                    ],
                    selected: {_teachingMode},
                    onSelectionChanged: (s) => setState(() => _teachingMode = s.first),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _subjectsController,
                  decoration: const InputDecoration(
                    labelText: 'Subjects or skills (comma-separated)',
                    hintText: 'e.g. Guitar, Piano, Music Theory',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _classDurationController,
                  decoration: const InputDecoration(labelText: 'Default class duration (minutes)'),
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ),
          Step(
            title: const Text('Fees & availability'),
            isActive: _currentStep >= 3,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const EmptyState(
                  icon: Icons.payments_outlined,
                  message:
                      'Fee structures and weekly availability are set up once the Fees module '
                      'ships (docs/07 Phase 4 step 6). You can finish onboarding now and add '
                      'these later from your profile.',
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryStep extends ConsumerWidget {
  const _CategoryStep({required this.selectedId, required this.onSelected});

  final String? selectedId;
  final void Function(String id) onSelected;

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
            : Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final category in categories)
                    _CategoryChip(
                      category: category,
                      selected: category.id == selectedId,
                      onTap: () => onSelected(category.id),
                    ),
                ],
              ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.category, required this.selected, required this.onTap});

  final TeacherCategory category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(category.name),
      avatar: Icon(_iconFor(category.icon), size: 18),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }

  IconData _iconFor(String? name) => switch (name) {
        'school' => Icons.school_outlined,
        'home' => Icons.home_outlined,
        'sports' => Icons.sports_outlined,
        'music_note' => Icons.music_note_outlined,
        'directions_run' => Icons.directions_run_outlined,
        'fitness_center' => Icons.fitness_center_outlined,
        'self_improvement' => Icons.self_improvement_outlined,
        'palette' => Icons.palette_outlined,
        'translate' => Icons.translate_outlined,
        'computer' => Icons.computer_outlined,
        'groups' => Icons.groups_outlined,
        'person' => Icons.person_outline,
        'laptop' => Icons.laptop_outlined,
        _ => Icons.category_outlined,
      };
}
