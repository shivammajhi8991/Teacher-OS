/// Input shape for adding a guardian — mirrors backend GuardianInputDto (docs/03 §3.4). Used both
/// inline at student creation and standalone via the "add guardian" action.
class GuardianInput {
  const GuardianInput({
    required this.fullName,
    this.phone,
    this.email,
    this.relationship,
    this.isPrimary,
    this.consentDataSharing,
  });

  final String fullName;
  final String? phone;
  final String? email;
  final String? relationship;
  final bool? isPrimary;
  final bool? consentDataSharing;
}
