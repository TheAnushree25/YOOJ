import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { deckApi } from './server/dev-api.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The deck's functions read DECK_KEY from the environment, as they do when
  // deployed. Vite only exposes VITE_* variables to the page; this one is for
  // the server side of the dev server and never reaches the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.DECK_KEY && !process.env.DECK_KEY) process.env.DECK_KEY = env.DECK_KEY

  return {
    plugins: [vue(), deckApi()],
  }
})
