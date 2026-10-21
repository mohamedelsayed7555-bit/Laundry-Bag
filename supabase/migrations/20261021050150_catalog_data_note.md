# Catalog data applied directly (2026-10-21)

Two migrations ran against the project that only move data, not schema, and are not
reproduced here because a fresh environment seeds its own price list:

- `20261021045709_seed_catalog_sportswear_and_gaps` — added a ملابس رياضية category and
  filled in the service combinations missing from existing items (~110 price rows,
  `on conflict do nothing`, so no existing price was changed).
- `20261021050150_clean_junk_categories` — moved two items out of two leftover test
  categories and deleted the empty categories.

Also applied as plain data: `أخرى` moved to `sort_order = 99` so it always sorts last.
