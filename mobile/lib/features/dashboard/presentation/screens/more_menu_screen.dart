import 'package:flutter/material.dart';
import '../../../reports/presentation/screens/reports_screen.dart';

/// docs/08 §8.1 "More" on the Teacher shell: "Notes, Assignments, Reports, Settings" — burying
/// these one tap deeper keeps the primary bar from exceeding 5 items. Notes and Assignments are
/// real, but live as sections on the Class/Student Detail screens rather than through this menu
/// (see mobile/README.md's own entries for why — that predates this menu existing at all);
/// Settings has no screen anywhere yet. Reports is this menu's first real entry.
class MoreMenuScreen extends StatelessWidget {
  const MoreMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.summarize_outlined),
            title: const Text('Reports'),
            subtitle: const Text('Attendance, fees, and student reports'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ReportsScreen()),
            ),
          ),
        ],
      ),
    );
  }
}
