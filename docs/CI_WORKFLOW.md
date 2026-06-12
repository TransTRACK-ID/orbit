# GitHub Actions CI

Orbit ships a CI workflow at `.github/workflows/ci.yml` that runs `pnpm install` and `pnpm build` on pushes and pull requests to `main`.

## Workflow

The current workflow:

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

## Workflow scope note

If your push token lacks the GitHub `workflow` scope, the workflow file must be added via the GitHub web UI or a token with workflow permissions.

> **Note:** [orbit-docs](https://github.com/TransTRACK-ID/orbit-docs) still does not ship a `.github/workflows/` directory — consider adding CI there as well before public release.

## Future improvements

- Add Vitest unit tests when test coverage grows
- Lint step (`eslint`) if adopted project-wide
- Optional Docker image build on tagged releases
