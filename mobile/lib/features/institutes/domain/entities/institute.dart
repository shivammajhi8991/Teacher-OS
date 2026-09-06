/// Mirrors backend `Institute` entity — just the fields the Admin Panel's list/detail view
/// needs (docs/08 §8.2 Admin Web Panel "Institutes | List, drill into any institute's admin
/// view").
class Institute {
  const Institute({
    required this.id,
    required this.name,
    this.address,
    this.contactEmail,
    this.contactPhone,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String? address;
  final String? contactEmail;
  final String? contactPhone;
  final String status;
  final DateTime createdAt;
}
