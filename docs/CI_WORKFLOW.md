# GitHub Actions CI

CI is configured in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). It runs on pushes and pull requests to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm build` (with dummy `POSTGRES_URL` and `NUXT_AUTH_SECRET`)

If you need to add or modify workflows, ensure your git token has the `workflow` scope, or edit the file directly in the GitHub UI.
