# GitHub Actions CI

The push token used for this branch lacks the `workflow` scope, so CI must be added via the GitHub UI after merge.

Create `.github/workflows/ci.yml` with:

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

Alternatively, merge the PR and add the workflow file in a follow-up commit using a token with `workflow` scope.
