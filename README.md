# Botanic Inventory

Professional lightweight inventory / WMS demo for packs, boxes and stock movements.

## UX

- Premium dark, data-first interface
- Desktop sidebar + mobile bottom navigation
- Responsive layouts with large readable data surfaces
- All quantities are stored and displayed in **grams (g)**
- Pack IDs use the controlled `P-0001` format
- Box IDs, LOT, position and expiry are visible metadata
- Numeric quantities are right aligned with tabular numerals
- Every mutation uses a final confirmation summary
- Loading state uses a centered spinner and blurred workspace

## Operations

- Příjem
- Výdej
- Přesun packu
- Přesun boxu
- Pack and material details
- History + CSV export
- Demo reset

## Local Bun mode

```powershell
bun install
bun run validate
bun run json:check
bun run dev
```

Open `http://localhost:8080`.

Bun serves the UI and provides `/api/state` and `/api/reset`, so local mutations can be persisted to `data.json`.

## GitHub Pages

The repository contains `.github/workflows/pages.yml` and deploys automatically from `main` using GitHub Pages.

GitHub Pages is static and cannot write `data.json`. The application therefore uses `localStorage` automatically in Pages mode. `data.json` is the shipped dataset and `data.seed.json` is the reset source.

In the repository settings, set **Pages → Source → GitHub Actions** if Pages is not already enabled.

## Data model

```text
materials  → catalog + minimum grams
boxes      → physical containers
packs      → material + grams + box + position + LOT + expiry
history    → append-only movement audit
```
