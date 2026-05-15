# Project Context

This project is a fork of the original `appforzamira` certificate registry app. It keeps the same core workflow but uses a different certificate blank, registry columns, and form fields.

## Current Purpose

The app lets a user:

- Fill a Tajik/Russian certificate form on an A4-sized print canvas.
- Drag fields in calibration mode so printed text can be aligned with a physical blank.
- Save certificates into a Supabase-backed registry.
- Search/edit/delete registry rows.
- Copy/export the current form row to Excel.
- Save and reload reusable templates.

## Main Files

- `src/app/page.tsx` - main certificate editor page, toolbar, templates, saving to registry, Excel export.
- `src/app/components/CertificateEditor.tsx` - A4 print canvas and field layout definitions in millimeters.
- `src/app/components/DraggableField.tsx` - editable/drag-enabled absolute-positioned fields.
- `src/app/registry/page.tsx` - registry table, search, inline edits, loading a registry row back into the blank.
- `src/lib/certificateTypes.ts` - canonical form shape, registry column order/labels, draft constants, service-list serialization helpers.
- `src/lib/supabase.ts` - public Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/autoReplace.ts` - abbreviation expansion rules stored in the `templates` table under a system row.
- `schema.sql` - Supabase tables and permissive RLS policies for this app.

## Data Model

`CertificateFormData` is the source of truth for the current certificate:

- unique fields: blank number, certificate number, date fields
- provider/director/service/document/tax/inspection/head fields
- `services_list` is an array in the UI
- `text_color_overrides` exists in the type, but is not currently rendered by `DraggableField`

The `certificates.services_list` database column is `TEXT`. New saves store it as a JSON string array. The helper `normalizeServicesList()` can also read old pipe-separated values like `a | b | c`.

## Local Storage

The main form draft uses:

- key: `cert_form_draft_v2`
- version: `1`

Keep `FORM_DRAFT_KEY` and `FORM_DRAFT_VERSION` imported from `src/lib/certificateTypes.ts` anywhere a page needs to hand data back to the editor. The registry "В бланк" action depends on this.

Field calibration uses:

- key: `cert_field_layouts`
- version: `LAYOUT_VERSION` in `CertificateEditor.tsx`

Bump `LAYOUT_VERSION` whenever `DEFAULT_LAYOUTS` changes, otherwise old user layouts in localStorage will override new defaults.

## Supabase

Required env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Without them the app falls back to placeholders and saving/loading will fail. The current `.env` with only `SUPABASE_ACCESS_TOKEN` is not enough for the browser app.

Tables:

- `certificates` - registry rows
- `templates` - user templates and the system auto-replacement row

RLS is enabled, but policies are permissive for all CRUD operations.

## Known Legacy/Unused Pieces

These are leftovers from the older app and should not be treated as active unless reconnected intentionally:

- `src/lib/parseCertificate.ts` - old PDF text parser for a different registry shape.
- `openai` and `pdf-parse` dependencies in `package.json`.
- `next.config.mjs` `serverComponentsExternalPackages: ['pdf-parse']`.
- Mentions in `CLAUDE.md` of `/api/parse`, `/api/parse-quantity`, `/settings`, `/appendix`, `PrintPreview`, and `printLayout.ts`.

The current repository has no actual API routes under `src/app/api`.

## Verification Notes

Use the bundled local Node/npm on this machine if global npm is unavailable:

```powershell
$env:Path = "$PWD\nodejs\node-v24.15.0-win-x64;$env:Path"
.\nodejs\node-v24.15.0-win-x64\npm.cmd run lint
.\nodejs\node-v24.15.0-win-x64\npm.cmd run build
```

Next build may try to patch SWC dependencies in `package-lock.json` if the lockfile is incomplete.
