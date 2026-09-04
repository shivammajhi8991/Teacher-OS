# notes module (not yet implemented)

Scaffolded per docs/07-roadmap.md Phase 4 step 7. Covers `documents`, `document_shares`,
`document_access_log` (docs/03 §3.8). Uploads go through the presigned-URL flow (docs/02 §2.6) —
this module issues the presigned URL and confirms metadata after upload; it never proxies the
file bytes itself.

Endpoints to implement: docs/04-api-design.md §4.4 "Notes / Assignments" (notes half).
