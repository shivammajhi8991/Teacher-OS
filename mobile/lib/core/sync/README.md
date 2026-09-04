# core/sync (not yet implemented)

The offline-first `SyncEngine` described in docs/05-flutter-architecture.md §5.4: a local Drift
mirror of the signed-in user's data, an optimistic write path through a local `sync_queue` table
(mirroring backend docs/03 §3.9), and a background drain job triggered by `connectivity_plus`
reconnect events + a periodic timer, using the same `Idempotency-Key` mechanism as
docs/04-api-design.md §4.2.

Ships alongside the first feature that needs offline writes (Attendance — docs/07 Phase 4 step 5).
`SyncStatusChip` (`core/widgets/sync_status_chip.dart`) is already built as the presentational
half; this is the state/engine half it will be wired to.
