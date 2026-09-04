import '../../domain/entities/guardian_info.dart';

/// Backend `GuardianSummary` shape (students.service.ts) — shared between GET /students/:id's
/// `guardians` entries and POST /students/:id/guardians' response, so this one mapper covers both.
class GuardianSummaryDto {
  const GuardianSummaryDto({
    required this.id,
    required this.fullName,
    this.phone,
    this.email,
    this.relationship,
    required this.isPrimary,
    required this.consentDataSharing,
  });

  factory GuardianSummaryDto.fromJson(Map<String, dynamic> json) => GuardianSummaryDto(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        relationship: json['relationship'] as String?,
        isPrimary: json['isPrimary'] as bool,
        consentDataSharing: json['consentDataSharing'] as bool,
      );

  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String? relationship;
  final bool isPrimary;
  final bool consentDataSharing;

  GuardianInfo toEntity() => GuardianInfo(
        id: id,
        fullName: fullName,
        phone: phone,
        email: email,
        relationship: relationship,
        isPrimary: isPrimary,
        consentDataSharing: consentDataSharing,
      );
}
