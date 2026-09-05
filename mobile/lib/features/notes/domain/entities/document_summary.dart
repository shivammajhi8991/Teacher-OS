/// Mirrors backend `DocumentSummary` (notes.service.ts). The mobile app only ever *creates*
/// `link`-type documents (docs/07 roadmap deviation, see notes_repository_impl.dart) but a
/// document of any `fileType` can show up here if someone else shared one with this class —
/// this app just can't open/download those yet (no `file_picker`/`url_launcher` dependency
/// pulled in for this pass), so non-link entries render as a plain, inert row.
class DocumentSummary {
  const DocumentSummary({
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

  final String id;
  final String title;
  final String fileType; // 'pdf' | 'image' | 'video' | 'audio' | 'link' | 'other'
  final String? folderName;
  final DateTime? expiryDate;
  final int version;
  final bool isExpired;
  final DateTime createdAt;
  final String? externalUrl; // only set when fileType == 'link'

  bool get isLink => fileType == 'link';
}
