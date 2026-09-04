# fees module (not yet implemented)

Scaffolded per docs/07-roadmap.md Phase 4 step 6. Covers `fee_structures`, `discounts`,
`invoices` (immutable once issued), `invoice_line_items`, `credit_notes`, `payments`,
`payment_audit_log`, `refunds`, `institute_teacher_payouts` (docs/03 §3.7). Gateway payments are
only ever confirmed via the webhook handler — never the client response (docs/01 §1.5, docs/04
§4.4). All money-touching writes require the `Idempotency-Key` header (docs/04 §4.2).

Endpoints to implement: docs/04-api-design.md §4.4 "Fees & Payments".
