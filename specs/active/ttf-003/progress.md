# ttf-003 — Progress

## Status: shipped

All phases of the [plan](plan.md) are implemented and verified.

## What landed

### Phase 1 — PDF write safety

- `apps/desktop/src-tauri/capabilities/default.json` now allows `fs:allow-write-file` so binary PDF bytes can be written by Tauri's FS plugin.
- `apps/desktop/src/views/InvoicesView.tsx` now writes the PDF before creating the invoice row and lines.
- Save cancellation exits cleanly without creating an invoice.
- File write failures are thrown with the target path and displayed by the existing mutation error UI.
- Empty billable ranges return a clear `No billable entries in this range` error.

### Phase 2 — Reusable invoice profile

`apps/desktop/src/views/SettingsView.tsx` now has an Invoice profile section with:

- Name or business
- Email
- Multi-line address
- Tax ID / VAT number
- Logo upload and preview
- Signature upload and preview
- Generic payment instructions

All values are persisted in the existing local `settings` key/value table through the `Settings` repo. No migration was added.

### Phase 3 — Image encoding helpers

`apps/desktop/src/lib/encode-logo.ts` now includes:

- `encodeImage` for shared canvas resizing.
- `encodeOwnerLogo` for contain-fit PNG logo data URLs.
- `encodeSignature` for contain-fit transparent PNG signatures.

The existing client logo encoder remains available for ttf-002 client avatars.

### Phase 4 — PDF contract and layout

`packages/invoice-pdf/src/InvoiceDocument.tsx` now exports an `InvoiceParty` type and extends `InvoiceData` with:

- Sender tax ID and logo data.
- Recipient address, tax ID, phone, and website.
- Payment instructions.
- Signature image and printed-name fallback.

The PDF template now renders:

- Branded header with logo, sender contact, invoice number, issued date, and due date.
- Sender and bill-to cards with address and tax ID details.
- Stronger line-item table with zebra striping and numeric alignment.
- Notes beside a clearer totals hierarchy.
- Payment instructions section.
- Signature block near the footer.

### Phase 5 — Verification

- `pnpm --filter @ttf/invoice-pdf typecheck` — clean.
- `pnpm --filter @ttf/desktop typecheck` — clean.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` — clean.
- `pnpm -w lint` — clean.
- `ReadLints` on touched files — clean.

## Manual verification note

Manual PDF export should be run in the desktop app after the Tauri dev process has picked up the capability rebuild. The target flow is: fill Invoice profile in Settings, generate an invoice to Desktop or Downloads, confirm the PDF exists, opens, and the invoice row stores `pdf_path`.

## Deferred

- Cleanup of any old invoice rows that were created before the write-order fix and have a missing or broken `pdf_path`.
- Paper.id-specific payment integration or branding.
- Remote blob storage for profile logo/signature images.
