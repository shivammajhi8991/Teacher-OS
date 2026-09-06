import 'package:flutter/material.dart';
import '../screens/calendar_screen.dart';

/// docs/08 §8.2 "Calendar | ... | Dashboard quick action" — worded identically for all four
/// mobile roles, so one shared card (unlike Announcements' institute-only compose action) rather
/// than a per-dashboard copy.
class CalendarQuickActionCard extends StatelessWidget {
  const CalendarQuickActionCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.calendar_month_outlined),
        title: const Text('Calendar'),
        subtitle: const Text('This week\'s classes, assignments, and fees due'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const CalendarScreen()),
        ),
      ),
    );
  }
}
