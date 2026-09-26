import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { siteApi } from './server/dev-api.ts'

/**
 * What the server functions read from the environment, as they do when
 * deployed: the deck's key. Vite only exposes VITE_* variables to the page;
 * this is for the server side of the dev server and never reaches the browser
 * bundle. A value already in the real environment wins over .env.local.
 */
const SERVER_ENV = ['DECK_KEY']

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of SERVER_ENV) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [vue(), siteApi()],
  }
})
