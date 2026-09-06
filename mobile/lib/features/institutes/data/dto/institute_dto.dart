import '../../domain/entities/institute.dart';

class InstituteDto {
  const InstituteDto({
    required this.id,
    required this.name,
    this.address,
    this.contactEmail,
    this.contactPhone,
    required this.status,
    required this.createdAt,
  });

  factory InstituteDto.fromJson(Map<String, dynamic> json) => InstituteDto(
        id: json['id'] as String,
        name: json['name'] as String,
        address: json['address'] as String?,
        contactEmail: json['contactEmail'] as String?,
        contactPhone: json['contactPhone'] as String?,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String name;
  final String? address;
  final String? contactEmail;
  final String? contactPhone;
  final String status;
  final DateTime createdAt;

  Institute toEntity() => Institute(
        id: id,
        name: name,
        address: address,
        contactEmail: contactEmail,
        contactPhone: contactPhone,
        status: status,
        createdAt: createdAt,
      );
}
