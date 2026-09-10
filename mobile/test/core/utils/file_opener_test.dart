import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/file_opener.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

/// `UrlLauncherPlatform.instance` is the plugin's own `PlatformInterface` test seam — the exact
/// same pattern `file_picker`'s `FilePicker.platform` uses — so a fake swaps in without ever
/// touching a real browser/app.
class _FakeUrlLauncherPlatform extends UrlLauncherPlatform {
  _FakeUrlLauncherPlatform({required this.launchResult});

  final bool launchResult;
  String? lastLaunchedUrl;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> canLaunch(String url) async => launchResult;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    lastLaunchedUrl = url;
    return launchResult;
  }
}

// openExternalUrl is what every one of this pass's three touched screens (class_detail_screen's
// Notes section, AssignmentSubmitScreen, AssignmentReviewScreen) actually calls to open a
// link — tested once here rather than through three separate widget harnesses, since the
// logic that varies screen to screen is just a few lines of branching/SnackBar around this one
// shared call.
void main() {
  test('launches a well-formed URL and reports success', () async {
    final fake = _FakeUrlLauncherPlatform(launchResult: true);
    UrlLauncherPlatform.instance = fake;

    final opened = await openExternalUrl('https://example.com/syllabus.pdf');

    expect(opened, isTrue);
    expect(fake.lastLaunchedUrl, 'https://example.com/syllabus.pdf');
  });

  test('reports failure rather than throwing when nothing on the device can handle the URL', () async {
    UrlLauncherPlatform.instance = _FakeUrlLauncherPlatform(launchResult: false);

    final opened = await openExternalUrl('https://example.com/syllabus.pdf');

    expect(opened, isFalse);
  });
}
