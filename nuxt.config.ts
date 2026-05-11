// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1',
    },
  },

  modules: [
    '@sidebase/nuxt-auth',
    'nuxt-icon',
  ],

  auth: {
    // IMPORTANT: Set AUTH_ORIGIN to your public deployment URL (e.g. https://orbit.yourdomain.com)
    // In Coolify, pass this as a build argument AND runtime environment variable.
    baseURL: process.env.AUTH_ORIGIN || 'http://localhost:3000',
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
})
