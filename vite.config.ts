import { cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { siteApi } from './server/dev-api.ts'

/**
 * What the server functions read from the environment, as they do when
 * deployed: the deck's key. Vite only exposes VITE_* variables to the page;
 * this is for the server side of the dev server and never reaches the browser
 * bundle. A value already in the real environment wins over .env.local.
 */
const SERVER_ENV = ['DECK_KEY']

/**
 * The sealed deck, copied into the built site at /_sealed, for yooj.care's
 * Cloudflare Worker (cloudflare/worker.js), which reads its slides from the
 * site's own files. Ciphertext, and already in the repository - a Node host
 * reads deck/sealed directly and simply never asks for these.
 */
const sealedDeck = (): Plugin => ({
  name: 'yooj-sealed-deck',
  apply: 'build',
  async writeBundle(options) {
    const from = resolve(process.cwd(), 'deck', 'sealed')
    if (options.dir && existsSync(from)) await cp(from, resolve(options.dir, '_sealed'), { recursive: true })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of SERVER_ENV) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [vue(), siteApi(), sealedDeck()],
  }
})
