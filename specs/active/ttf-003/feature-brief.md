# ttf-003 — Invoice PDF export + branded invoice profile

## Summary

Upgrade invoice generation from a minimal receipt-style PDF into a client-facing invoice flow. The feature fixes binary PDF export in Tauri, adds reusable invoice profile fields in Settings, and redesigns the generated PDF with sender identity, tax details, payment instructions, logo, and signature.

## Status

- **Spec**: shipped — documented after implementation via `/evolve`
- **Implementation**: shipped — see [progress.md](progress.md) and [todo-list.md](todo-list.md)
- **Depends on**: ttf-001 invoice generation, ttf-002 richer client fields (`address`, `tax_id`, contact metadata)

## Goals

- Fix the bug where the save dialog opens but no PDF is written to disk.
- Prevent failed PDF writes from creating invoice rows with unusable `pdf_path` values.
- Add a reusable local invoice profile in Settings without adding schema migrations.
- Render professional invoice PDFs with sender details, bill-to details, tax IDs, payment instructions, logo, and signature.

## Non-goals

- Paper.id-specific branding or payment rails.
- Remote logo/signature storage.
- Database migrations for invoice profile fields.
- Cleanup of old invoice rows that may already have missing or broken `pdf_path` values.

## Changelog

### 2026-04-27 - Addition: Invoice Profile And PDF Export Upgrade

**Context**: Invoice generation showed a native save prompt, but binary PDF bytes were not written because the Tauri capability allowed text writes only. The existing invoice PDF also lacked reusable sender identity and payment details.

**Change**: Added binary FS permission, reordered invoice generation to write the PDF before creating invoice rows, added Settings-backed invoice profile fields, extended `InvoiceData`, and redesigned the PDF template.

**Impact**: Invoice export is now safer and produces a client-facing PDF. Profile data remains local-first in the `settings` table.

**Decision**: Use generic payment instructions instead of Paper.id-specific branding, and store logo/signature as PNG data URLs in settings.
