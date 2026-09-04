/// docs/03 §3.3 `teacher_profiles` — the subset the onboarding flow and (later) the profile
/// screen need. `teachingMode` mirrors the backend enum ('online' | 'offline' | 'both').
class TeacherProfile {
  const TeacherProfile({
    required this.id,
    required this.teacherCategoryId,
    this.headline,
    this.bio,
    this.experienceYears,
    this.serviceArea,
    required this.teachingMode,
    this.classDurationMinutesDefault,
    required this.verificationStatus,
  });

  final String id;
  final String teacherCategoryId;
  final String? headline;
  final String? bio;
  final int? experienceYears;
  final String? serviceArea;
  final String teachingMode;
  final int? classDurationMinutesDefault;
  final String verificationStatus; // 'unverified' | 'pending' | 'verified'
}
