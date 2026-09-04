import '../../domain/entities/student.dart';

class StudentDto {
  const StudentDto({
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

  factory StudentDto.fromJson(Map<String, dynamic> json) => StudentDto(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
        dob: json['dob'] as String?,
        gender: json['gender'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        emergencyContactName: json['emergencyContactName'] as String?,
        emergencyContactPhone: json['emergencyContactPhone'] as String?,
        medicalNotes: json['medicalNotes'] as String?,
        joinDate: json['joinDate'] as String,
        enrollmentStatus: json['enrollmentStatus'] as String,
      );

  final String id;
  final String fullName;
  final String? dob;
  final String? gender;
  final String? avatarUrl;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? medicalNotes;
  final String joinDate;
  final String enrollmentStatus;

  Student toEntity() => Student(
        id: id,
        fullName: fullName,
        dob: dob,
        gender: gender,
        avatarUrl: avatarUrl,
        emergencyContactName: emergencyContactName,
        emergencyContactPhone: emergencyContactPhone,
        medicalNotes: medicalNotes,
        joinDate: joinDate,
        enrollmentStatus: enrollmentStatus,
      );
}
