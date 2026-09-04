# notifications module (not yet implemented)

Scaffolded per docs/07-roadmap.md Phase 4 step 8. Covers `notifications`,
`notification_preferences`, `announcements` (docs/03 §3.8) and the FCM fan-out + digest-batching
worker described in docs/02 §2.5 (BullMQ) — real-time delivery deliberately stays push+poll, no
websockets, per docs/04 §4.6.

Endpoints to implement: docs/04-api-design.md §4.4 "Communication / Notifications / Calendar"
(notifications half).
