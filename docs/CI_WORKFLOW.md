# GitHub Actions CI

Add this workflow as `.github/workflows/ci.yml` after merging (requires a token with `workflow` scope to push workflow files via CLI):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm build
        env:
          POSTGRES_URL: postgres://postgres:postgres@localhost:5432/orbit
          NUXT_AUTH_SECRET: ci-build-secret-key-at-least-32-chars
```
