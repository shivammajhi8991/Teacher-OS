import '../../domain/entities/teacher_roster_entry.dart';

class TeacherRosterEntryDto {
  const TeacherRosterEntryDto({
    required this.id,
    required this.fullName,
    this.email,
    this.headline,
    required this.verificationStatus,
    this.payoutPercent,
  });

  factory TeacherRosterEntryDto.fromJson(Map<String, dynamic> json) => TeacherRosterEntryDto(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
        email: json['email'] as String?,
        headline: json['headline'] as String?,
        verificationStatus: json['verificationStatus'] as String,
        payoutPercent: json['payoutPercent'] as String?,
      );

  final String id;
  final String fullName;
  final String? email;
  final String? headline;
  final String verificationStatus;
  final String? payoutPercent;

  TeacherRosterEntry toEntity() => TeacherRosterEntry(
        id: id,
        fullName: fullName,
        email: email,
        headline: headline,
        verificationStatus: verificationStatus,
        payoutPercent: payoutPercent,
      );
}
