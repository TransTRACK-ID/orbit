// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@sidebase/nuxt-auth',
    'nuxt-icon',
  ],

  auth: {
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
