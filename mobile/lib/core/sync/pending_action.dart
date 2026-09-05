/// docs/05 §5.4 offline write path. One queued mutation awaiting server confirmation.
/// `payload` carries everything the eventual replay call needs — kept as a plain JSON map
/// rather than a typed class per action, since the queue only has one action type today
/// ('attendance_bulk_mark', see sync_engine.dart) and a typed-per-action hierarchy would be
/// pure ceremony until a second one exists.
class PendingAction {
  const PendingAction({
    required this.id,
    required this.actionType,
    required this.payload,
    required this.createdAt,
    this.lastError,
  });

  factory PendingAction.fromJson(Map<String, dynamic> json) => PendingAction(
        id: json['id'] as String,
        actionType: json['actionType'] as String,
        payload: Map<String, dynamic>.from(json['payload'] as Map),
        createdAt: DateTime.parse(json['createdAt'] as String),
        lastError: json['lastError'] as String?,
      );

  final String id;
  final String actionType;
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final String? lastError;

  PendingAction withError(String error) => PendingAction(
        id: id,
        actionType: actionType,
        payload: payload,
        createdAt: createdAt,
        lastError: error,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'actionType': actionType,
        'payload': payload,
        'createdAt': createdAt.toIso8601String(),
        if (lastError != null) 'lastError': lastError,
      };
}
