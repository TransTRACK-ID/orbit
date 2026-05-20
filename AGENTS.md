# Agent Notes for Orbit

## Working with Impeccable Live Mode

### Agent Guardrail — NEVER Edit app.vue for Live Script

**You must NEVER add, edit, or inject `<script src="http://localhost:8400/live.js">` into `app.vue` (or any `.vue` file's `<template>` block).** Doing so causes a fatal Vite compilation error because Vue's compiler strips `<script>` tags from templates:

> `[plugin:vite:vue] Tags with side effect (<script> and <style>) are ignored in client component templates.`

If the live script is already in `app.vue`, remove it immediately and move it to `nuxt.config.ts` (see below).

### The Nuxt/Vue Trap

Impeccable's live mode injects a `<script>` tag into the project's HTML entry point. For Nuxt 3, the default inject target is `app.vue` (or `app.html`). **Vue's compiler strips `<script>` and `<style>` tags from `<template>` blocks** with a Vite overlay error:

> `[plugin:vite:vue] Tags with side effect (<script> and <style>) are ignored in client component templates.`

This means the standard live-inject flow (`live-inject.mjs --port`) does **not** work when targeting `.vue` files or `app.html`.

### The Correct Injection Point for Nuxt

Use **`nuxt.config.ts`** instead. Add the live script to `app.head.script`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      script: [
        {
          innerHTML: `
            (function() {
              const stored = localStorage.getItem('dark-mode');
              if (stored === 'true' || (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            })();
          `,
        },
        { src: 'http://localhost:8400/live.js' },
      ],
    },
  },
})
```

**Why this works:** Nuxt injects these scripts into the SSR-rendered HTML `<head>`, before Vue's template compiler ever sees them.

### Live Mode Setup Steps

1. **Configure `.impeccable/live/config.json`**
   ```json
   {
     "files": ["app.vue"],
     "insertBefore": "</template>",
     "commentSyntax": "html",
     "cspChecked": true
   }
   ```
   *Note: The `files` field is required by the config validator, even though we don't actually use the inject tool for Nuxt. Keep it as `app.vue` — we manually manage the script in `nuxt.config.ts` instead.*

2. **Manually add the script to `nuxt.config.ts`** (see above).

3. **Run `live.mjs` to start the server:**
   ```bash
   node ~/.agents/skills/impeccable/scripts/live.mjs
   ```
   This starts the helper server on port 8400 and prints context.

4. **Poll for browser events:**
   ```bash
   node ~/.agents/skills/impeccable/scripts/live-poll.mjs
   ```

5. **When done, cleanup:**
   ```bash
   node ~/.agents/skills/impeccable/scripts/live-server.mjs stop
   ```
   Then remove the `{ src: 'http://localhost:8400/live.js' }` entry from `nuxt.config.ts`.

### Generating Variants in Vue SFCs

When the browser sends a `generate` event, the wrap script lands on the `.vue` source file. **Do not insert `<style>` tags inside the `<template>` block.** Vue will reject them with the same Vite overlay.

**Correct approach:**
- Keep all variant HTML inside the `<template>` block.
- Move the preview CSS to a `<style scoped>` block at the **end** of the `.vue` file (after `</script>`).
- Use plain descendant selectors (`.v1-root select { ... }`) instead of `@scope` rules. Vue's scoped CSS compiler handles them correctly.

**Example file structure after wrapping:**
```vue
<template>
  <Teleport to="body">
    <!-- impeccable-variants-start ID -->
    <div data-impeccable-variants="ID" style="display: contents">
      <!-- Original -->
      <div data-impeccable-variant="original">...</div>
      <!-- Variants go here -->
      <div data-impeccable-variant="1">...</div>
      <div data-impeccable-variant="2" style="display: none">...</div>
      <div data-impeccable-variant="3" style="display: none">...</div>
    </div>
    <!-- impeccable-variants-end ID -->
  </Teleport>
</template>

<script setup>...</script>

<style scoped>
  .v1-root select { ... }
  .v2-root .v2-section { ... }
  .v3-root:hover { ... }
</style>
```

### Cleanup After Live Session

Always verify three things are removed:

1. **Live script from `nuxt.config.ts`** (the `localhost:8400/live.js` entry).
2. **Variant wrappers and variant divs** from any `.vue` files that were modified. Search for `impeccable-variants-start` and `impeccable-variants-end`.
3. **Scoped preview CSS** from the bottom of modified `.vue` files. Look for `<style scoped>` blocks containing `.v1-`, `.v2-`, `.v3-` selectors.

**Quick cleanup script:**
```bash
# Stop the server
node ~/.agents/skills/impeccable/scripts/live-server.mjs stop

# Remove live script from nuxt.config.ts
sed -i '' "/localhost:8400\/live.js/d" nuxt.config.ts

# Find files with leftover variant markers
grep -rl "impeccable-variants-start" components/ pages/ layouts/
```

### Common Issues

| Issue | Cause | Fix |
|---|---|---|
| Vite overlay: `<script>` ignored in template | `live-inject.mjs` wrote into `app.vue` `<template>` | Use `nuxt.config.ts` `app.head.script` instead |
| Vite overlay: `<style>` ignored in template | Preview CSS inserted inside `<template>` block | Move CSS to `<style scoped>` after `</script>` |
| Live script not in served HTML | Nuxt dev server hasn't picked up config change | Restart `npm run dev` or trigger HMR by editing `nuxt.config.ts` |
| Poll returns `config_missing` | `.impeccable/live/config.json` doesn't exist | Create it with `files: ["app.vue"]` and `cspChecked: true` |
| Browser shows no live picker | CSP blocks `localhost:8400` | Add `http://localhost:8400` to `script-src` and `connect-src` in dev mode |
