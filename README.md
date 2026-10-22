# Delphic Admin

Back-office for Delphic Arcana Collection: fund flows, exhibitions, and NFC links.

The panel is a Next.js static export in `frontend/`. The API is a Cloudflare Pages Function in `functions/`, and the data lives in Cloudflare D1.

## Local development

```bash
cd frontend && pnpm install && pnpm dev
```

Deploy and D1 are configured in [`wrangler.jsonc`](wrangler.jsonc).

## Accent

The accent is `#F6ADC6` (抚子粉, Nadeshiko). The runner-up is `#FFB7C5` (樱花, cherry blossom).

The other candidates are in [`docs/accent-compare.html`](docs/accent-compare.html):

- `#F3B6C0`, the previous accent
- `#EFBBCC`, Cameo Pink (ISCC-NBS)
- `#F091A9`, Mauvelous (Crayola)

## CI

[`.github/workflows/ci-pr.yml`](.github/workflows/ci-pr.yml) typechecks and builds the frontend on pull requests to `main` and on pushes to `main`.
