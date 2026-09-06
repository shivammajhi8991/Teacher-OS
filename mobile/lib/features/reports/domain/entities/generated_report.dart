import 'dart:typed_data';

/// A report as returned by `GET /reports/*` — the raw file bytes plus enough to save/display it.
/// No JSON DTO layer exists for this feature (unlike every other feature here) because there's
/// no JSON to map: the backend responds with the file itself (docs/04 §4.4), so the repository
/// reads the bytes straight off the Dio response.
class GeneratedReport {
  const GeneratedReport({
    required this.bytes,
    required this.filename,
    required this.contentType,
  });

  final Uint8List bytes;
  final String filename;
  final String contentType; // 'text/csv' | 'application/pdf'

  bool get isCsv => contentType == 'text/csv';
}
