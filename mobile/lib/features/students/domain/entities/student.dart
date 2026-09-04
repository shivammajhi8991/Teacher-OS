/// docs/03 §3.4 `student_profiles`. `enrollmentStatus` mirrors the backend enum
/// ('active' | 'inactive' | 'left' | 'archived') — docs/01 §1.3: students are archived, never
/// hard-deleted, so 'archived' is a real, filterable status here, not a client-side concept.
class Student {
  const Student({
    required this.id,
    required this.fullName,
    this.dob,
    this.gender,
    this.avatarUrl,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.medicalNotes,
    required this.joinDate,
    required this.enrollmentStatus,
  });

  final String id;
  final String fullName;
  final String? dob;
  final String? gender;
  final String? avatarUrl;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? medicalNotes;
  final String joinDate; // ISO date (yyyy-MM-dd)
  final String enrollmentStatus;
}
