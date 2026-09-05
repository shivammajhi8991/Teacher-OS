import '../../domain/entities/document_summary.dart';

class DocumentSummaryDto {
  const DocumentSummaryDto({
    required this.id,
    required this.title,
    required this.fileType,
    required this.folderName,
    required this.expiryDate,
    required this.version,
    required this.isExpired,
    required this.createdAt,
    required this.externalUrl,
  });

  factory DocumentSummaryDto.fromJson(Map<String, dynamic> json) => DocumentSummaryDto(
        id: json['id'] as String,
        title: json['title'] as String,
        fileType: json['fileType'] as String,
        folderName: json['folderName'] as String?,
        expiryDate: json['expiryDate'] == null ? null : DateTime.parse(json['expiryDate'] as String),
        version: json['version'] as int,
        isExpired: json['isExpired'] as bool,
        createdAt: DateTime.parse(json['createdAt'] as String),
        externalUrl: json['externalUrl'] as String?,
      );

  final String id;
  final String title;
  final String fileType;
  final String? folderName;
  final DateTime? expiryDate;
  final int version;
  final bool isExpired;
  final DateTime createdAt;
  final String? externalUrl;

  DocumentSummary toEntity() => DocumentSummary(
        id: id,
        title: title,
        fileType: fileType,
        folderName: folderName,
        expiryDate: expiryDate,
        version: version,
        isExpired: isExpired,
        createdAt: createdAt,
        externalUrl: externalUrl,
      );
}
