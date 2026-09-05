import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/notes_providers.dart';

/// Mobile scope for docs/07 roadmap "Notes" (deliberately narrowed, documented deviation):
/// only `link`-type notes, created and shared with a class in one dialog. Uploading real files
/// (pdf/image/video/audio) needs a file picker and a way to open/preview them on-device — both
/// real, tested backend endpoints already exist (upload-url, storage upload, GET .../file) but
/// wiring up file_picker/open_file on mobile is left to a later pass so this one doesn't pull in
/// unverifiable new dependencies.
class AddLinkNoteDialog extends ConsumerStatefulWidget {
  const AddLinkNoteDialog({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<AddLinkNoteDialog> createState() => _AddLinkNoteDialogState();
}

class _AddLinkNoteDialogState extends ConsumerState<AddLinkNoteDialog> {
  final _titleController = TextEditingController();
  final _urlController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _titleController.dispose();
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final title = _titleController.text.trim();
    final url = _urlController.text.trim();
    if (title.isEmpty) {
      setState(() => _errorMessage = 'Enter a title');
      return;
    }
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
      setState(() => _errorMessage = 'Enter a valid URL (including https://)');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ref.read(notesRepositoryProvider).shareLinkWithClass(
          classId: widget.classId,
          title: title,
          url: url,
        );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) => Navigator.of(context).pop(true),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add link'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _titleController,
            decoration: const InputDecoration(labelText: 'Title'),
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _urlController,
            decoration: const InputDecoration(labelText: 'URL', hintText: 'https://…'),
            keyboardType: TextInputType.url,
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _confirm,
          child: _isSubmitting
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Share with class'),
        ),
      ],
    );
  }
}
