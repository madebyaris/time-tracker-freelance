# ttf-003 — Todo list

## Phase 1 — PDF write safety

- [x] T1.1 Add `fs:allow-write-file` in `apps/desktop/src-tauri/capabilities/default.json`.
- [x] T1.2 Reorder `InvoicesView` generation so PDF write succeeds before invoice rows are created.
- [x] T1.3 Surface write failures near the Generate invoice button.
- [x] T1.4 Avoid invoice row creation when the user cancels the save dialog.

## Phase 2 — Invoice profile in Settings

- [x] T2.1 Add address and tax ID fields to Settings.
- [x] T2.2 Add logo upload and preview.
- [x] T2.3 Add signature upload and preview.
- [x] T2.4 Add payment instructions textarea.
- [x] T2.5 Persist profile values in existing `Settings` repo keys.

## Phase 3 — PDF contract

- [x] T3.1 Add reusable `InvoiceParty` shape.
- [x] T3.2 Extend `InvoiceData.from` with `tax_id` and `logo_data`.
- [x] T3.3 Add `payment_instructions`, `signature_data`, and `signature_name`.
- [x] T3.4 Pass selected client `address`, `tax_id`, `phone`, and `website` into the bill-to block.

## Phase 4 — PDF redesign

- [x] T4.1 Add branded header with logo, invoice number, issue date, and due date.
- [x] T4.2 Add sender and client blocks with address and tax IDs.
- [x] T4.3 Improve line-item table spacing, row separation, and totals hierarchy.
- [x] T4.4 Add generic payment instructions section.
- [x] T4.5 Add signature block with uploaded image or printed-name fallback.

## Phase 5 — Verification

- [x] T5.1 `pnpm --filter @ttf/invoice-pdf typecheck`.
- [x] T5.2 `pnpm --filter @ttf/desktop typecheck`.
- [x] T5.3 `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.
- [x] T5.4 `pnpm -w lint`.
- [x] T5.5 `ReadLints` on touched files.

## Progress log

| When | What |
|---|---|
| 2026-04-27 | Implemented binary PDF write permission and safer invoice creation ordering. |
| 2026-04-27 | Added Settings-backed invoice profile fields for sender identity, logo, signature, and payment instructions. |
| 2026-04-27 | Extended invoice PDF data contract and redesigned the PDF layout. |
| 2026-04-27 | Typecheck, cargo check, lint, and editor diagnostics passed. |
