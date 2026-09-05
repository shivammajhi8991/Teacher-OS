import '../../../../core/utils/result.dart';
import '../entities/document_summary.dart';

abstract interface class NotesRepository {
  /// The Notes section on Class Detail: every document uploaded by the current user whose
  /// `folderName` tags it as belonging to this class. This is a client-side convention, not a
  /// server-enforced relation — real access control for *other* people viewing this class's
  /// notes is still the `document_shares` row created by [shareLinkWithClass], not this tag.
  Future<Result<List<DocumentSummary>>> getClassLinkNotes(String classId);

  /// docs/07 roadmap "Notes" (mobile scope): create a `link`-type document tagged to this class
  /// and immediately share it with the class in one call, matching the ≤3-tap flow used
  /// elsewhere (spec §11) — "Add link", fill title + URL, confirm.
  Future<Result<void>> shareLinkWithClass({
    required String classId,
    required String title,
    required String url,
    DateTime? expiryDate,
  });
}
