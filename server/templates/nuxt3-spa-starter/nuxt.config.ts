// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  app: {
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
    },
  },

  build: {
    transpile: ["@vuepic/vue-datepicker", "gsap"],
  },

  css: ["@/assets/css/global.css"],

  modules: [
    "@vite-pwa/nuxt",
    "@nuxtjs/tailwindcss",
    "@pinia/nuxt",
    "@pinia-plugin-persistedstate/nuxt",
    "@sidebase/nuxt-auth",
    "nuxt3-leaflet",
    "@nuxt/image",
    "@nuxt/test-utils/module",
  ],

  ssr: false,

  auth: {
    provider: {
      type: "local",
      endpoints: {
        signIn: {
          path: `/login`,
          method: "post",
        },
        signOut: {
          path: "/signOut",
          method: "post",
        },
        getSession: {
          path: "/getSession",
          method: "get",
        },
      },
      pages: {
        login: "/login",
      },
      token: {
        signInResponseTokenPointer: "/data/access_token",
        maxAgeInSeconds: 60 * 60 * 24,
      },
    },
    globalAppMiddleware: true,
  },

  runtimeConfig: {
    appKey: process.env.APP_KEY,
    public: {
      // Client-side base URL — should be relative so requests go through the preview proxy
      baseAPI: process.env.NUXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL,
    },
    // Server-only base URL — can be absolute (e.g. http://127.0.0.1:port/api/preview/taskId)
    // so server-side $fetch gets a valid URL instead of crashing on relative paths
    apiBaseUrl: process.env.API_BASE_URL,
    // Explicit preview flag — set by Orbit in Live Preview. Handlers check this
    // to return mock responses instead of calling a non-existent external API.
    isPreview: process.env.ORBIT_PREVIEW === 'true',
  },

  compatibilityDate: "2025-01-31",

  vite: {
    server: {
      watch: {
        ignored: ["**/node_modules/**", "**/.git/**"],
      },
    },
  },
});
