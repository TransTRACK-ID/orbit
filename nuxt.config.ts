// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  devServer: {
    host: '0.0.0.0',
  },

  // Prevent Nuxt from treating the server/templates sub-projects as layers.
  // The templates contain their own nuxt.config.ts files but are NOT part of this app.
  ignore: [
    'server/templates/**',
    '**/server/templates/**',
    '**/*.test.ts',
    '**/vitest.config.ts',
  ],

  // Restrict Nuxt's workspace to the project root so it won't auto-discover
  // nested nuxt.config.ts files (e.g. server/templates/*/nuxt.config.ts) as layers.
  workspaceDir: '.',

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1',
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
      ],
    },
  },

  modules: [
    '@sidebase/nuxt-auth',
    '@nuxt/icon',
  ],

  auth: {
    // IMPORTANT: Set AUTH_ORIGIN to your public deployment URL (e.g. https://orbit.yourdomain.com)
    // In Coolify, pass this as a build argument AND runtime environment variable.
    // For local dev, use a relative path so it works on any port (e.g. 3000, 9475).
    baseURL: process.env.AUTH_ORIGIN || '/api/auth',
    provider: {
      type: 'authjs',
      trustHost: true,
      defaultProvider: 'credentials',
    },
    session: {
      strategy: 'jwt',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    globalAppMiddleware: true,
  },

  components: [
    { path: '~/components/general', prefix: '' },
    { path: '~/components/icons', prefix: '' },
    { path: '~/components/layout', prefix: 'Layout' },
    '~/components',
  ],

  css: ['~/assets/css/main.css'],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  runtimeConfig: {
    authSecret: process.env.NUXT_AUTH_SECRET || 'super-secret-key-change-in-production',
    postgresUrl: process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/orbit',
  },

  compatibilityDate: '2024-09-01',

  vite: {
    server: {
      watch: {
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
      // Allow requests from the live preview proxy host
      allowedHosts: 'all',
    },
  },
})
