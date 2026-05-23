// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  app: {
    // Disable transitions in preview mode — they can cause DOM instability
    // in iframe contexts and are not essential for preview functionality.
    pageTransition: process.env.ORBIT_PREVIEW === 'true' ? false : { name: "page", mode: "out-in" },
    layoutTransition: process.env.ORBIT_PREVIEW === 'true' ? false : { name: "layout", mode: "out-in" },
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
    // In Orbit Live Preview NUXT_APP_BASE_URL is set to /api/preview/{taskId}/.
    // Without this, auth requests (e.g., /api/auth/login) hit the parent Orbit
    // app instead of the preview dev server, causing "unsupported action login".
    baseURL: process.env.NUXT_APP_BASE_URL
      ? `${process.env.NUXT_APP_BASE_URL}api/auth`
      : '/api/auth',
    provider: {
      type: "local",
      endpoints: {
        signIn: {
          path: `/login`,
          method: "post",
        },
        signOut: {
          path: "/logout",
          method: "post",
        },
        getSession: {
          path: "/session",
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
    isPreview: process.env.ORBIT_PREVIEW === 'true' || process.env.NUXT_IS_PREVIEW === 'true',
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
