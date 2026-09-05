/// Mirrors backend `PreferenceSummary` (notifications.service.ts's getPreferences) — always one
/// row per known category, resolved to either the user's stored choice or the category default,
/// never missing a category the way a raw preference-table read could.
class NotificationPreference {
  const NotificationPreference({required this.category, required this.channel});

  final String category; // 'payment' | 'fee' | 'note' | 'general'
  final String channel; // 'push' | 'email' | 'digest_daily' | 'digest_weekly' | 'off'
}
