import 'dart:io';
import 'dart:typed_data';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens [url] in the device's own external handler — the browser for an `https://` link, a
/// mail app for `mailto:`, and so on. Every `link`-type Note and every Assignment/submission
/// attachment this app itself ever creates is a real URL, so this is the only opener either
/// feature needs for that content.
///
/// Returns `false` (never throws) when [url] doesn't parse or nothing on the device can handle
/// it — the caller decides how to tell the user, matching this app's existing
/// `Result<T>`-at-the-repository/plain-bool-at-the-UI-action split elsewhere.
Future<bool> openExternalUrl(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return false;
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Writes [bytes] to a fresh temp file named [filename] and hands it to whatever app the OS
/// already associates with that name's extension — a PDF viewer, the gallery, a media player.
/// This app never renders file content itself, the same "hand off to the OS" choice Reports'
/// own generated-PDF flow already makes (saved to the documents directory there, since that
/// file is meant to persist; a temp file is right here since it's only ever a one-time view).
///
/// Throws [FileOpenException] if the OS has nothing registered for the file — the caller decides
/// how to tell the user, matching every other async action in this app (a thrown/Err value
/// becomes a SnackBar at the call site, never a silent failure).
Future<void> openDownloadedBytes(Uint8List bytes, String filename) async {
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}${Platform.pathSeparator}$filename');
  await file.writeAsBytes(bytes, flush: true);
  final result = await OpenFilex.open(file.path);
  if (result.type != ResultType.done) {
    throw FileOpenException(result.message);
  }
}

class FileOpenException implements Exception {
  FileOpenException(this.message);
  final String message;

  @override
  String toString() => message;
}
